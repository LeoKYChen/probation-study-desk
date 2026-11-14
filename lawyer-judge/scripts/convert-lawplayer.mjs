#!/usr/bin/env node
/*
 * 律司備考平臺｜LawPlayer 試題 .txt 轉換
 *
 * 把從 https://lawplayer.com/exam/lawyer 下載的試卷 .txt（考選部歷屆試題，LawPlayer 整理）
 * 轉成 scripts/import-questions.mjs 可匯入的 JSON。
 *
 * 用法：
 *   node scripts/convert-lawplayer.mjs <檔案.txt|資料夾> [...] [-o 輸出.json] [--exam 律師,司法官]
 *   之後：node scripts/import-questions.mjs 輸出.json --merge
 *
 * 處理內容：
 *   - 第二試申論題：還原被 LawPlayer 拆錯的題號（例如把參考法條裡的「二、」誤當成第 2 題），
 *     重新依題號切題；合併 PDF 斷行；附上去重後的「參考法條」。
 *   - 第一試選擇題：解析選項與「正解」，另存成 <輸出>-stage1.json。
 *     目前網站沒有選擇題作答介面，這份檔案先保存，不會被匯入。
 *
 * 試題本身依著作權法第 9 條第 1 項第 5 款不得為著作權標的；LawPlayer 標示資料採政府資料開放授權。
 * 本程式只轉換格式，不核對內容；請以考選部公告的試題為準。
 */
import {readFileSync, writeFileSync, statSync, readdirSync} from 'node:fs';
import {resolve, join, extname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
// 試卷名稱 → 題目的科目（第二試合卷題同時涉及兩科時，保留合卷名稱）
const PAPER_SUBJECT = [
  [/憲法與行政法/, '憲法與行政法'],
  [/民法與民(事訴訟法|訴)/, '民法與民事訴訟法'],
  [/刑法與刑事訴訟法/, '刑法與刑事訴訟法'],
  [/公司法.*保險法.*證(券)?交/, '公司法、保險法與證券交易法'],
  [/國文/, '國文'],
  [/智慧財產/, '智慧財產法'], [/勞動社會/, '勞動社會法'], [/財稅/, '財稅法'], [/海商/, '海商法與海洋法']
];
// 第一試各卷依現行配分推得的科目題數（每題 2 分）。總題數不符時不推定科目。
const STAGE1_RANGES = [
  [/綜合法學一.*刑法/, [['刑法', 35], ['刑事訴訟法', 25], ['法律倫理', 15]], '卷一'],
  [/綜合法學一.*憲法/, [['憲法', 20], ['行政法', 35], ['國際公法', 10], ['國際私法', 10]], '卷二'],
  [/綜合法學二.*民法/, [['民法', 50], ['民事訴訟法', 30]], '卷三'],
  // 卷四實際順序：公司→保險→票據→證券交易→強制執行→法學英文（以 107–115 年各卷的題目內容逐題核對過；LawPlayer 標題的科目順序與實際不同）
  [/綜合法學二.*(商法|公司)/, [['公司法', 15], ['保險法', 10], ['票據法', 10], ['證券交易法', 10], ['強制執行法', 10], ['法學英文', 15]], '卷四']
];

// 解析 LawPlayer 的「正解」：單一選項、「C 或 D（官方更正，均給分）」、或缺漏
// 考試別預設「律師,司法官」（使用者決定）；選試科目只有律師第二試有，固定為律師。--exam 可覆寫。
const ELECTIVE_SUBJECTS = ['智慧財產法', '勞動社會法', '財稅法', '海商法與海洋法'];
const examFor = (opts, subject) => opts.exam || (ELECTIVE_SUBJECTS.includes(subject) ? '律師' : '律師,司法官');

export function parseAnswer(raw, optionCount) {
  const text = (raw || '').trim();
  const letters = [...new Set((text.match(/[A-E]/g) || []))];
  if (optionCount !== 4) return {answer: null, acceptedAnswers: [], status: 'incomplete', answerNote: '原檔選項不完整，本題不計分，請查考選部原卷'};
  if (!letters.length) return {answer: null, acceptedAnswers: [], status: 'incomplete', answerNote: '原檔沒有正解（可能是更正後一律給分），本題不計分，請查考選部更正答案'};
  if (letters.length === 1 && /^[A-E]$/.test(text)) return {answer: letters[0], acceptedAnswers: letters, status: 'ok', answerNote: ''};
  if (letters.length > 1 && /更正|均給分/.test(text)) return {answer: letters[0], acceptedAnswers: letters, status: 'multi', answerNote: text};
  return {answer: null, acceptedAnswers: [], status: 'incomplete', answerNote: `無法判讀原檔正解「${text}」，本題不計分`};
}

const norm = s => s.normalize('NFKC').replace(/\s+/g, '');
// 「112 年8 月1 日」「第66 條第1 項」這類 PDF 轉檔空白
const tidy = s => s.replace(/(\d)\s+(?=[㐀-鿿（(])/g, '$1').replace(/([㐀-鿿])\s+(?=\d)/g, '$1').replace(/[ \t]+$/g, '');

export function parseHeader(lines) {
  const m = lines[0]?.match(/^(律師|司法官)\s*(\d+)\s*年(.+?)考古題（共\s*(\d+)\s*題）/);
  if (!m) throw Error('第一行不是 LawPlayer 試卷標頭（例如「律師 114 年憲法與行政法考古題（共 2 題）」）');
  const url = lines.slice(1, 5).find(l => /^https:\/\/lawplayer\.com\//.test(l.trim()))?.trim() || null;
  const slug = url ? decodeURIComponent(url.split('/').pop()) : `${m[2]}-${m[3]}`;
  return {exam: m[1], year: Number(m[2]), paper: m[3].trim(), count: Number(m[4]), url, code: slug.replace(/[\s<>"'`]/g, '-')};
}

/* ---------- 第二試申論 ---------- */
const ARTICLE_LINE = /^第\s*\d+\s*條(之\s*\d+)?(第\s*\d+\s*項)?(第\s*\d+\s*款)?$/; // 法條標題自成一行
const ITEM_START = /^(㈠|㈡|㈢|㈣|㈤|㈥|[一二三四五六七八九十]+、|[（(][一二三四五六七八九十\d]+[）)]|〈|參考法條|【)/;
const ENUM_LINE = /^([一二三四五六七八九十]+、|[（(][一二三四五六七八九十\d]+[）)])/;
const ARTICLE = ARTICLE_LINE;

// LawPlayer 會把「N、」換成「第 N 題」標記：先還原成原卷文字
export function restoreNumbering(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^第\s*(\d+)\s*題\s*$/);
    if (m) {
      const n = Number(m[1]), next = lines[i + 1] ?? '';
      out.push((NUMERALS[n] || String(n)) + '、' + next.replace(/^\s+/, ''));
      i++;
    } else out.push(lines[i]);
  }
  return out;
}

// 依「二、」「三、」切題，但排除參考法條中的列舉款次。
// 大題開頭必須：位於上一題第一個配分之後；之後確實出現配分；且到該配分之前沒有任何法條標題。
const SCORE = /[（(][^（）()]*?\d+\s*分/; // 也接受「（文長以100字為限，10分）」
const STATUTE_HEADER = line => ARTICLE.test(line) || /^〈.*〉$/.test(line) || line === '參考法條';
export function splitEssays(lines) {
  const T = lines.map(l => l.trim());
  const firstScoreAfter = i => { for (let j = i; j < T.length; j++) if (SCORE.test(T[j])) return j; return -1; };
  const starts = [0];
  for (let k = 2; ; k++) {
    const prefix = (NUMERALS[k] || String(k)) + '、';
    const after = firstScoreAfter(starts.at(-1));
    if (after < 0) break;
    let found = -1;
    for (let i = after + 1; i < T.length && found < 0; i++) {
      if (!T[i].startsWith(prefix)) continue;
      const s = firstScoreAfter(i);
      if (s < 0) break;
      if (T.slice(i + 1, s).some(STATUTE_HEADER)) continue;
      // 同一配分之前若還有同樣開頭的行，取最後一行（前面的是被誤標題號的法條款次）
      found = i;
      for (let j = i + 1; j < s; j++) if (T[j].startsWith(prefix)) found = j;
    }
    if (found < 0) break;
    starts.push(found);
  }
  return starts.map((s, k) => lines.slice(s, starts[k + 1] ?? lines.length));
}

// 去除參考法條尾端重複貼上的段落與殘句
export function dedupeStatutes(lines) {
  let L = lines.filter(l => l.trim()), removed = false;
  for (let changed = true; changed;) {
    changed = false;
    const n = L.length, N = L.map(norm);
    for (let k = Math.floor(n / 2); k >= 3; k--) {
      const tail = N.slice(n - k).join('\n');
      for (let i = 0; i + k <= n - k; i++) {
        if (N.slice(i, i + k).join('\n') === tail) { L = L.slice(0, n - k); changed = removed = true; break; }
      }
      if (changed) break;
    }
  }
  // 重複段落被切掉後，尾端常留下 1–3 行殘句（很短或以「……」結尾，且已出現在前文）
  for (let guard = 0; removed && guard < 3 && L.length > 3; guard++) {
    const raw = L.at(-1).trim(), last = norm(raw), before = L.slice(0, -1).map(norm).join('');
    if (last && (last.length <= 12 || /……$/.test(raw)) && before.includes(last)) L = L.slice(0, -1); else break;
  }
  return L;
}

// 合併 PDF 硬斷行：遇到款次、條號、法規名稱或上一行以句號等結尾時才換行
export function joinLines(lines) {
  const out = [];
  for (const raw of lines) {
    const line = tidy(raw.trim());
    if (!line) continue;
    const prev = out.at(-1);
    if (prev && /^[（(]\d+分[）)]$/.test(line)) { out[out.length - 1] = prev + line; continue; } // 單獨一行的配分
    const newPara = !prev || ITEM_START.test(line) || ARTICLE_LINE.test(line) || /[。：？！」』…]$/.test(prev) || /[）)]$/.test(prev) && !/[（(][^）)]*$/.test(prev.slice(0, -1)) && /^[（(]/.test(line) || ARTICLE_LINE.test(prev) || /^〈.*〉$/.test(prev) || prev === '參考法條';
    if (newPara) out.push(line); else out[out.length - 1] = prev + line;
  }
  return out;
}

// LawPlayer 有時把其他題的參考法條貼在題目開頭：第一個配分之前若出現條號行，
// 刪到該條文段落結束（以句號、」或）結尾的行）為止。回傳 [清理後的行, 刪除的行數]
export const FULL_MARKS = {'憲法與行政法': 200, '刑法與刑事訴訟法': 200, '民法與民事訴訟法': 150, '公司法、保險法與證券交易法': 100, '國文': 100};

export function stripLeadingStatutes(part) {
  const T = part.map(l => l.trim());
  const score = T.findIndex(l => SCORE.test(l));
  let cut = 0;
  for (let i = 0; i < (score < 0 ? 0 : score); i++) {
    if (!ARTICLE_LINE.test(T[i])) continue;
    // 段落結束：以句號或」結尾，且引號、括號都已閉合
    let j = i + 1, open = 0;
    for (; j < score; j++) {
      open += (T[j].match(/[「（(]/g) || []).length - (T[j].match(/[」）)]/g) || []).length;
      if (open <= 0 && /(。|」)[）)]?$/.test(T[j])) break;
    }
    if (j >= score) break;
    cut = j + 1; i = j;
  }
  if (!cut) return [part, 0];
  const prefix = (T[0].match(/^[一二三四五六七八九十]+、/) || [''])[0];
  const rest = part.slice(cut);
  if (prefix && rest.length) rest[0] = prefix + rest[0].replace(/^\s+/, '');
  return [rest, cut];
}

export function convertEssayPaper(text, opts = {}) {
  const lines = text.replace(/\r/g, '').split('\n');
  const h = parseHeader(lines);
  const firstMarker = lines.findIndex(l => /^第\s*\d+\s*題\s*$/.test(l.trim()));
  if (firstMarker < 0) throw Error('找不到「第 1 題」');
  let body = lines.slice(firstMarker);
  const footer = body.findIndex(l => /^題庫收錄歷年原題/.test(l.trim()));
  const note = footer >= 0 ? body[footer].trim() : '';
  if (footer >= 0) body = body.slice(0, footer);
  const restored = restoreNumbering(body);
  const parts = splitEssays(restored);
  const subject = opts.subject || PAPER_SUBJECT.find(([re]) => re.test(h.paper))?.[1];
  if (!subject) throw Error(`無法由試卷名稱「${h.paper}」判斷科目；請用 --subject 指定`);
  const warnings = [];
  const questions = parts.map((rawPart, idx) => {
    const n = idx + 1;
    const [part, cut] = stripLeadingStatutes(rawPart);
    if (cut) warnings.push(`第 ${n} 題開頭有 ${cut} 行疑似其他題的參考法條，已刪除，請人工核對`);
    const lawAt = part.findIndex(l => l.trim() === '參考法條');
    const main = lawAt >= 0 ? part.slice(0, lawAt) : part;
    const statutes = lawAt >= 0 ? dedupeStatutes(part.slice(lawAt + 1)) : [];
    const mainText = joinLines(main).join('\n').replace(/^[一二三四五六七八九十]+、/, '');
    const lawText = statutes.length ? '\n\n【參考法條】\n' + joinLines(statutes).join('\n') : '';
    const firstLine = mainText.split('\n')[0].replace(/\s+/g, '');
    return {
      id: `lawplayer-${h.code}-${n}`,
      exam: examFor(opts, subject),
      subject, year: h.year, questionNo: n, stage: 2,
      title: `${h.year} 年${h.paper}第 ${n} 題｜${firstLine.slice(0, 18)}${firstLine.length > 18 ? '…' : ''}`,
      body: mainText + lawText,
      source: '考選部歷屆試題（LawPlayer 整理）',
      sourceUrl: h.url,
      guidanceNote: (note ? note + ' ' : '') + '題目由 LawPlayer 下載檔轉換；切題與參考法條已自動整理，請對照考選部原卷。'
    };
  });
  // 以配分總和核對是否漏題或多切（第二試各科滿分；合卷依現行配分）
  const full = FULL_MARKS[subject] ?? 100;
  const sum = questions.reduce((a, q) => a + [...q.body.split('【參考法條】')[0].matchAll(/[（(][^（）()]*?(\d+)\s*分\s*[）)]/g)].reduce((x, m) => x + Number(m[1]), 0), 0);
  // LawPlayer 標頭題數常把法條款次算進去，配分合計正確時不再提醒
  if (sum !== full && parts.length !== h.count) warnings.push(`標頭寫共 ${h.count} 題，實際切出 ${parts.length} 題，請人工核對`);
  if (sum !== full) warnings.push(`配分合計 ${sum} 分，與滿分 ${full} 分不符，可能漏題或切錯，請對照考選部原卷`);
  return {header: h, questions, warnings, scoreSum: sum, fullMarks: full};
}

/* ---------- 第一試選擇題 ---------- */
export function convertChoicePaper(text, opts = {}) {
  const lines = text.replace(/\r/g, '').split('\n');
  const h = parseHeader(lines);
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^第\s*(\d+)\s*題$/);
    if (m) { cur = {no: Number(m[1]), stem: [], options: [], answer: ''}; blocks.push(cur); continue; }
    if (!cur || !line || /^題庫收錄/.test(line)) continue;
    const opt = line.match(/^\(([A-E])\)\s*(.*)$/);
    const ans = line.match(/^正解[：:]\s*(.+)$/);
    if (ans) cur.answer = ans[1].trim();
    else if (opt) cur.options.push(tidy(opt[2]));
    else if (cur.options.length) cur.options[cur.options.length - 1] += tidy(line);
    else cur.stem.push(line);
  }
  const warnings = [];
  if (blocks.length !== h.count) warnings.push(`標頭寫共 ${h.count} 題，實際解析 ${blocks.length} 題`);
  const found = STAGE1_RANGES.find(([re]) => re.test(h.paper));
  const ranges = found?.[1], paperNo = found?.[2] ?? null;
  const total = ranges?.reduce((a, [, c]) => a + c, 0);
  if (ranges && total !== blocks.length) warnings.push(`依現行配分推定的題數（${total}）與實際題數（${blocks.length}）不同，科目改標為試卷名稱`);
  const subjectOf = no => {
    if (!ranges || total !== blocks.length) return h.paper;
    let acc = 0;
    for (const [s, c] of ranges) { acc += c; if (no <= acc) return s; }
    return h.paper;
  };
  const questions = blocks.map(b => ({
    // 殘缺題（選項不是 4 個或沒有正解）的選項多半是 PDF 轉檔後的碎片，不保留，避免誤導
    id: `lawplayer-${h.code}-${b.no}`, exam: examFor(opts, subjectOf(b.no)), subject: subjectOf(b.no), year: h.year, questionNo: b.no, stage: 1, type: 'mcq', paper: paperNo, paperTitle: h.paper,
    title: `${h.year} 年${h.paper}第 ${b.no} 題`, body: joinLines(b.stem).join('\n'), options: parseAnswer(b.answer, b.options.length).status === 'incomplete' ? [] : b.options,
    ...parseAnswer(b.answer, b.options.length),
    source: '考選部歷屆試題（LawPlayer 整理）', sourceUrl: h.url
  }));
  for (const q of questions) if (q.status === 'incomplete') warnings.push(`第 ${q.questionNo} 題選項或正解不完整，標為不計分`);
  return {header: h, questions, warnings};
}

export function convertFile(text, opts = {}) {
  return /^正解[：:]/m.test(text) ? {kind: 'stage1', ...convertChoicePaper(text, opts)} : {kind: 'stage2', ...convertEssayPaper(text, opts)};
}

/* ---------- 命令列 ---------- */
function listInputs(args) {
  const files = [];
  for (const a of args) {
    const p = resolve(process.cwd(), a);
    if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) { if (extname(f).toLowerCase() === '.txt') files.push(join(p, f)); }
    else files.push(p);
  }
  return files;
}
function main() {
  const args = process.argv.slice(2);
  const take = flag => { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const out = take('-o') || 'lawplayer-questions.json';
  const exam = take('--exam'), subject = take('--subject');
  const inputs = listInputs(args);
  if (!inputs.length) { console.error('用法：node scripts/convert-lawplayer.mjs <檔案.txt|資料夾> [-o 輸出.json] [--exam 律師,司法官]'); process.exit(2); }
  const essays = [], choices = [];
  let warnCount = 0;
  for (const file of inputs) {
    try {
      const r = convertFile(readFileSync(file, 'utf8'), {exam, subject});
      (r.kind === 'stage2' ? essays : choices).push(...r.questions);
      console.log(`${r.warnings.length ? '注意' : '完成'}  ${basename(file)}：${r.header.year} 年${r.header.paper}，${r.kind === 'stage2' ? '申論' : '選擇'} ${r.questions.length} 題`);
      for (const w of r.warnings) { console.log('      ' + w); warnCount++; }
    } catch (e) { console.error(`失敗  ${basename(file)}：${e.message}`); process.exitCode = 1; }
  }
  if (essays.length) { writeFileSync(resolve(process.cwd(), out), JSON.stringify(essays, null, 2) + '\n'); console.log(`\n申論題 ${essays.length} 題 → ${out}\n下一步：node scripts/import-questions.mjs ${out} --merge`); }
  if (choices.length) {
    const out1 = out.replace(/\.json$/i, '') + '-stage1.json';
    writeFileSync(resolve(process.cwd(), out1), JSON.stringify(choices, null, 2) + '\n');
    console.log(`\n第一試選擇題 ${choices.length} 題 → ${out1}\n（網站目前沒有選擇題作答介面，這份檔案先保存，不會被匯入。）`);
  }
  if (warnCount) console.log(`\n有 ${warnCount} 則提醒，請對照考選部原卷確認。`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
