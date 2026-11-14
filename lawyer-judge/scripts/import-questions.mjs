#!/usr/bin/env node
/*
 * 律司備考平臺｜題庫匯入
 *
 * 把使用者自備的申論題（JSON 或 CSV）寫入全站共用的題庫檔：
 *   questions.js、v2.5/questions.js、professional/source-main-questions.js  → window.QUESTION_BANK
 *   related-questions.js、v2.5/related-questions.js、professional/source-related-questions.js → window.RELATED_QUESTION_BANK
 *   active-recall/bank.js → window.RECALL_BANK（依題目重建回想回合，保留各科作答方法練習）
 *
 * 用法：
 *   node scripts/import-questions.mjs <檔案.json|檔案.csv> [--merge] [--dry-run]
 *   node scripts/import-questions.mjs --empty            # 清空所有題庫（保留格式）
 *   node scripts/import-questions.mjs --rebuild-recall   # 只依現有題庫重建主動回憶
 *   node scripts/import-questions.mjs --daily <檔案.json|檔案.csv> [--merge] [--dry-run]
 *                                                      # 匯入每日模擬題（daily-simulation/questions.json）
 *
 *   node scripts/import-questions.mjs --mcq <檔案.json|檔案.csv> [--merge] [--dry-run]
 *                                                      # 匯入第一試選擇題（mcq/bank.js）
 *
 *   --merge    與現有題庫合併（相同 id 以匯入內容為準）；預設為整份取代
 *   --dry-run  只檢查格式並列出結果，不寫檔
 *
 * 欄位（JSON 物件或 CSV 標題列）：
 *   body        必填。題目全文
 *   subject     必填。單科名稱，須為 SUBJECTS 之一（如：民法、刑事訴訟法）
 *   exam        律師、司法官，或「律師,司法官」（預設兩者）
 *   year        民國年度，例如 115
 *   questionNo  題號
 *   title       標題（省略時自動產生）
 *   points      參考要點；JSON 用陣列，CSV 用 | 分隔
 *   direction   作答方向；JSON 用陣列，CSV 用 | 分隔
 *   source、sourceUrl、guidanceNote  來源與說明
 *   bank        main（預設）或 related
 *   stage       2（預設）。第一試選擇題目前不支援：原專案的練習模組都是申論流程
 *   id          省略時以「年度-科目-題號」產生
 *
 * 每日模擬題（--daily）欄位：
 *   date        必填。YYYY-MM-DD
 *   subject     必填。單科名稱（同上），跨科題填「跨科整合」
 *   question    必填。題目全文（也接受 body）
 *   issues      爭點整理；JSON 可用陣列（每項一行），CSV 用 | 分隔
 *   outline     參考架構（文字）
 *   theoryTable 四欄表，JSON 為 [[欄1,欄2,欄3,欄4], ...]；CSV 不支援，留空即可
 *   sourceReference、reviewStatus（預設「待核對」）、id
 *
 * 第一試選擇題（--mcq）欄位：
 *   body        必填。題幹
 *   subject     必填。第一試科目：憲法、行政法、國際公法、國際私法、刑法、刑事訴訟法、法律倫理、
 *               民法、民事訴訟法、公司法、保險法、票據法、證券交易法、強制執行法、法學英文
 *   options     必填。四個選項（JSON 陣列；CSV 用 | 分隔）。選項殘缺的題目請標 status=incomplete
 *   answer      A–D；官方更正均給分時填第一個，並在 acceptedAnswers 列出全部（如 ["A","C"]）
 *   status      ok（預設，須有 answer）｜multi（更正均給分，須有 2 個以上 acceptedAnswers）｜
 *               incomplete（選項或正解殘缺，網站不計分）
 *   year、questionNo、exam、paper（卷一～卷四）、answerNote、source、sourceUrl、id
 *
 * 不得匯入你無權使用的題目；本腳本不會核對題目來源或法規是否正確。
 */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SUBJECTS = ['憲法','行政法','民法','民事訴訟法','刑法','刑事訴訟法','公司法','保險法','證券交易法','票據法','強制執行法','國際公法','國際私法','法律倫理','法學英文','國文','智慧財產法','勞動社會法','財稅法','海商法與海洋法'];
export const GROUP_OF = {
  '憲法':'憲法與行政法','行政法':'憲法與行政法',
  '民法':'民法與民事訴訟法','民事訴訟法':'民法與民事訴訟法',
  '刑法':'刑法與刑事訴訟法','刑事訴訟法':'刑法與刑事訴訟法',
  '公司法':'公司法、保險法與證券交易法','保險法':'公司法、保險法與證券交易法','證券交易法':'公司法、保險法與證券交易法',
  '國文':'國文',
  '智慧財產法':'選試科目','勞動社會法':'選試科目','財稅法':'選試科目','海商法與海洋法':'選試科目'
};
// 第二試合卷題同時涉及兩科以上時，可直接用合卷名稱（例如 LawPlayer 轉換的第二試試卷）
export const PAPERS = ['憲法與行政法','民法與民事訴訟法','刑法與刑事訴訟法','公司法、保險法與證券交易法'];
for (const p of PAPERS) GROUP_OF[p] = p;
const ALLOWED = [...SUBJECTS, ...PAPERS];
const EXAMS = ['律師','司法官'];
const ELECTIVES = ['智慧財產法','勞動社會法','財稅法','海商法與海洋法'];

const MAIN_FILES = ['questions.js','v2.5/questions.js','professional/source-main-questions.js'];
const RELATED_FILES = ['related-questions.js','v2.5/related-questions.js','professional/source-related-questions.js'];
const RECALL_FILE = 'active-recall/bank.js';
const DAILY_FILE = 'daily-simulation/questions.json';
const MCQ_FILE = 'mcq/bank.js';
export const MCQ_SUBJECTS = ['憲法','行政法','國際公法','國際私法','刑法','刑事訴訟法','法律倫理','民法','民事訴訟法','公司法','保險法','票據法','證券交易法','強制執行法','法學英文'];
export const MCQ_PAPERS = ['卷一','卷二','卷三','卷四'];

/* ---------- 讀寫題庫檔 ---------- */
function readGlobal(file, name) {
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) return undefined;
  const sandbox = {window: {}};
  vm.runInNewContext(readFileSync(abs, 'utf8'), sandbox, {filename: file});
  return sandbox.window[name];
}
function writeBank(file, name, data, header) {
  const body = `${header ? header + '\n' : ''}window.${name} = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(resolve(ROOT, file), body, 'utf8');
}
const BANK_HEADER = '/* 由 scripts/import-questions.mjs 產生；請勿手動編輯。題目為使用者自備，來源請自行核對。 */';

/* ---------- 解析輸入 ---------- */
export function parseCSV(text) {
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.replace(/^﻿/, '').trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
function readInput(file) {
  const text = readFileSync(resolve(process.cwd(), file), 'utf8').replace(/^﻿/, '');
  if (extname(file).toLowerCase() === '.csv') return parseCSV(text);
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.questions)) return json.questions;
  throw Error('JSON 須為題目陣列，或含 questions 陣列的物件');
}
const list = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean)
  : typeof v === 'string' ? v.split(/\s*\|\s*|\n/).map(x => x.trim()).filter(Boolean) : [];

/* ---------- 正規化與驗證 ---------- */
export function normalize(raw, index) {
  const errors = [];
  const where = `第 ${index + 1} 筆`;
  const body = String(raw.body ?? '').trim();
  const subject = String(raw.subject ?? '').trim();
  if (!body) errors.push(`${where}：缺少 body（題目全文）`);
  if (!ALLOWED.includes(subject)) errors.push(`${where}：subject「${subject}」不是可用科目（單科：${SUBJECTS.join('、')}；合卷：${PAPERS.join('、')}）`);
  const stage = raw.stage === undefined || raw.stage === '' ? 2 : Number(raw.stage);
  if (stage !== 2) errors.push(`${where}：這裡只匯入第二試申論題（stage=2）；第一試選擇題請改用 --mcq`);
  let exams = list(Array.isArray(raw.examTypes) ? raw.examTypes : String(raw.exam ?? raw.examType ?? '').replace(/、/g, ','));
  exams = exams.flatMap(x => x.split(',')).map(x => x.trim()).filter(Boolean);
  if (!exams.length) exams = ELECTIVES.includes(subject) ? ['律師'] : [...EXAMS];
  const badExam = exams.filter(x => !EXAMS.includes(x));
  if (badExam.length) errors.push(`${where}：exam 只能是 律師 或 司法官，收到「${badExam.join('、')}」`);
  if (ELECTIVES.includes(subject) && exams.includes('司法官')) errors.push(`${where}：${subject} 是律師第二試選試科目，司法官考試沒有此科`);
  const yearRaw = String(raw.year ?? '').trim();
  const year = yearRaw === '' ? null : Number(yearRaw);
  if (yearRaw !== '' && !(Number.isInteger(year) && year > 0 && year < 300)) errors.push(`${where}：year 須為民國年度整數，例如 115`);
  const noRaw = String(raw.questionNo ?? '').trim();
  const questionNo = noRaw === '' ? null : Number(noRaw);
  if (noRaw !== '' && !(Number.isInteger(questionNo) && questionNo > 0)) errors.push(`${where}：questionNo 須為正整數`);
  const bank = String(raw.bank || 'main').trim();
  if (!['main', 'related'].includes(bank)) errors.push(`${where}：bank 只能是 main 或 related`);
  const id = String(raw.id ?? '').trim() || [year ?? 'x', subject, questionNo ?? index + 1].join('-');
  if (/[\s<>"'`]/.test(id) || id.length > 200) errors.push(`${where}：id「${id}」含空白或不允許的字元`);
  const title = String(raw.title ?? '').trim() ||
    `${year ? year + ' 年' : '自備題'}${questionNo ? '第 ' + questionNo + ' 題' : ''}｜${subject}｜${body.replace(/\s+/g, ' ').slice(0, 24)}${body.length > 24 ? '…' : ''}`;
  const q = {
    id, year, examType: exams[0], examTypes: exams, subject, subjectGroup: GROUP_OF[subject] || subject,
    questionNo, title, body, points: list(raw.points), direction: list(raw.direction),
    sourceUrl: String(raw.sourceUrl ?? '').trim() || null, source: String(raw.source ?? '').trim() || '使用者匯入',
    guidanceNote: String(raw.guidanceNote ?? '').trim() || '參考要點由使用者提供，非官方標準答案；法條與實務見解請自行核對。'
  };
  if (q.sourceUrl && !/^https:\/\//.test(q.sourceUrl)) errors.push(`${where}：sourceUrl 須為 https 網址`);
  return {q, bank, errors};
}

/* ---------- 主動回憶 ---------- */
const SCOPE = '先用自己的話寫一至三個要點；卡住時再看提示。';
const METHOD = {
  '憲法': {hint: '先確認受限制的基本權、限制手段與要審查的對象。', skeleton: ['基本權保護範圍與限制', '形式合憲性：法律保留、授權明確、明確性', '實質合憲性：比例原則、平等原則與審查密度', '涵攝、理由與結論']},
  '行政法': {hint: '先判斷行政行為的法律性質與所在的程序階段。', skeleton: ['行政行為的性質：處分、命令、契約或事實行為', '法律依據、管轄與程序', '實體合法性與一般法律原則', '救濟途徑、期間與結論']},
  '民法': {hint: '先寫「誰得向誰，依據什麼，請求什麼」。', skeleton: ['請求權人、相對人與請求內容', '依序檢查請求權基礎：契約、無因管理、物權、侵權行為、不當得利', '構成要件、權利消滅與抗辯', '涵攝、理由與結論']},
  '民事訴訟法': {hint: '先確認題目所在的程序階段與當事人地位。', skeleton: ['程序階段與訴訟標的', '訴訟要件：管轄、當事人能力、訴訟能力、權利保護必要', '程序規定的要件與違反時的效果', '涵攝、理由與結論']},
  '刑法': {hint: '先按行為人與行為分開，辨認題目要處理的責任問題。', skeleton: ['行為人、行為與可能爭點', '構成要件、違法性與罪責', '未遂、錯誤、參與或競合等相關問題', '涵攝、理由與結論']},
  '刑事訴訟法': {hint: '先確認偵查、起訴或審判階段，以及採取處分的主體。', skeleton: ['程序階段與處分主體', '法律依據與要件：令狀、急迫性、告知義務等', '違法時的效果：證據能力與救濟', '涵攝、理由與結論']}
};
const COMMERCIAL = {hint: '先確認適用公司法、保險法或證券交易法，以及當事人地位。', skeleton: ['當事人地位與法律關係', '特別法的規定與要件', '與民法的補充適用關係', '涵攝、理由與結論']};
for (const s of ['公司法', '保險法', '證券交易法']) METHOD[s] = COMMERCIAL;
const METHOD_SUBJECTS = ['憲法','行政法','民法','民事訴訟法','刑法','刑事訴訟法','公司法','保險法','證券交易法'];

function basicItem(subject) {
  const m = METHOD[subject];
  return {
    id: 'basic-' + subject, subject, title: subject + '｜建立作答骨架', year: null,
    body: '科目共用方法練習，沒有對應到單一年度原題。', sourceUrl: null,
    reference: {kind: 'method', status: '作答方法核對；不是內容答案', legal: false, sources: [], points: []},
    rounds: [
      {title: '先定位', prompt: '拿到這一科的題目時，在寫答案前，你會先確認什麼？', hint: m.hint,
        criteria: ['先辨認題目要求、主體與情境。', '把問題定位後，再選擇適用的規範。'], label: '【補充基礎題｜目的：先定位題目】', kind: 'adapted', scope: SCOPE},
      {title: '建立骨架', prompt: '不看前文，寫出這一科常用的作答骨架。', hint: '先想判斷順序，再想哪些節點需要補理由。',
        criteria: m.skeleton, label: '【補充基礎題｜目的：建立科目作答順序】', kind: 'adapted', scope: SCOPE},
      {title: '避免只背名詞', prompt: '只寫法條或學說名稱，還少了什麼？請說一個要補上的步驟。', hint: '把要件連到具體事實，再說出推論。',
        criteria: ['補上規範與題目事實的連結。', '說明理由、結論與適用限制，而不只列名詞。'], label: '【補充基礎題｜目的：把知識連到事實】', kind: 'adapted', scope: SCOPE},
      {title: '回想式小結', prompt: '先不回看前文，用三句話說出你會如何定位、組織與應用這一科的答案。', hint: '想「問什麼 → 怎麼組織 → 如何說理」。',
        criteria: m.skeleton, label: '【階段小結】【補充基礎題｜目的：回想科目作答骨架】', kind: 'adapted', scope: SCOPE}
    ]
  };
}
function requirementsOf(body) {
  const parts = body.split(/(?<=[？?。])/).map(s => s.trim()).filter(s => /試|請|如何|是否|為何|何者/.test(s));
  return parts.length ? parts.slice(0, 6) : [body.replace(/\s+/g, ' ').slice(0, 200)];
}
function recallItem(q) {
  const points = q.points.length ? q.points : [];
  const fallback = ['對照題目設問逐項回答。', '交代規範依據、涵攝與結論。'];
  const all = points.length ? points : fallback;
  const pick = (a, b) => { const x = all.slice(a, b); return x.length ? x : all.slice(0, 2); };
  const where = `${q.year ? q.year + ' 年' : '自備題'}${q.examTypes.join('／')}／${q.subject}${q.questionNo ? '／第 ' + q.questionNo + ' 題' : ''}`;
  const label = `【考點改編題｜依據：${where}】`;
  const hint = METHOD[q.subject]?.hint || '先分清題目問什麼，再選擇適用的規範。';
  return {
    id: q.id, year: q.year, examType: q.examType, subject: q.subject, subjectGroup: q.subjectGroup, questionNo: q.questionNo,
    title: q.title, body: q.body, sourceUrl: q.sourceUrl, source: q.source,
    reference: points.length
      ? {kind: 'outline', status: '使用者匯入的參考要點；非官方標準答案', checkedAt: null, legal: true, sources: q.sourceUrl ? [{title: q.source, url: q.sourceUrl, checkedAt: null}] : [], points, requirements: requirementsOf(q.body)}
      : {kind: 'requirements', status: '本題未附參考要點；只核對題目要求與作答結構', checkedAt: null, legal: true, sources: q.sourceUrl ? [{title: q.source, url: q.sourceUrl, checkedAt: null}] : [], points: [], requirements: requirementsOf(q.body)},
    originalLabel: `【原題｜${where}】`,
    rounds: [
      {title: '定位考點', prompt: '先回想本題的第一個核心問題，用一句話說明它的意義或判斷關鍵。', hint, criteria: pick(0, 2), label, kind: 'adapted', scope: '這一回合先處理一個核心概念或爭點。'},
      {title: '提取骨架', prompt: '針對這一道題，寫出你會使用的判斷骨架。先列二至三個要點即可。', hint: '先想判斷順序，再想哪些節點需要補理由。', criteria: pick(2, 4), label, kind: 'adapted', scope: SCOPE},
      {title: '連到事實', prompt: '挑一個會影響判斷的題目事實，說明它如何改變結論。', hint: '選一個具體事實，接著補上「因為……，所以……」。', criteria: pick(-2), label, kind: 'adapted', scope: SCOPE},
      {title: '回想式小結', prompt: '先不回看前文：用三句話說出本題的核心問題、判斷骨架，以及一項應用或限制。', hint: '依序回想「問什麼 → 怎麼判斷 → 如何適用與有何限制」。', criteria: all, label: '【階段小結】' + label, kind: 'adapted', scope: SCOPE}
    ],
    originalRounds: [
      {title: '原題回想', prompt: q.body, hint: '先看題目的動詞與子題數量，安排回答順序；不確定的內容先標記待核對。', criteria: all, label: `【原題｜${where}】`, kind: 'original', scope: '先寫出完整的作答架構，再核對要點。'},
      {title: '回想式小結', prompt: '先不回看前文：用三句話回想這一題的核心問題、作答骨架，以及最需要再確認的內容。', hint: '先提取判斷骨架；有疑問就留下待查證項目，不必猜。', criteria: all, label: `【階段小結】【原題｜${where}】`, kind: 'original', scope: SCOPE}
    ]
  };
}
export function buildRecall(main, related) {
  const questions = [...main, ...related].map(recallItem);
  const names = [...new Set([...METHOD_SUBJECTS, ...questions.map(q => q.subject)])];
  return {
    version: 2, builtAt: new Date().toISOString().slice(0, 10), scope: '律師、司法官／使用者匯入題庫',
    subjects: names.map(name => ({name, count: questions.filter(q => q.subject === name).length})),
    questions, basic: METHOD_SUBJECTS.map(basicItem)
  };
}


/* ---------- 每日模擬題 ---------- */
export function normalizeDaily(raw, index) {
  const errors = [], where = `第 ${index + 1} 筆`;
  const date = String(raw.date ?? '').trim();
  const subject = String(raw.subject ?? '').trim();
  const question = String(raw.question ?? raw.body ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`${where}：date 須為 YYYY-MM-DD`);
  if (!ALLOWED.includes(subject) && subject !== '跨科整合') errors.push(`${where}：subject「${subject}」不是可用科目（或填「跨科整合」）`);
  if (!question) errors.push(`${where}：缺少 question（題目全文）`);
  const issues = Array.isArray(raw.issues) ? raw.issues.map(x => '- ' + String(x).trim()).join('\n') : list(raw.issues).length > 1 ? list(raw.issues).map(x => '- ' + x).join('\n') : String(raw.issues ?? '').trim();
  let theoryTable = raw.theoryTable ?? [];
  if (typeof theoryTable === 'string') theoryTable = theoryTable.trim() ? null : [];
  if (!Array.isArray(theoryTable) || !theoryTable.every(r => Array.isArray(r) && r.length === 4 && r.every(c => typeof c === 'string'))) {
    errors.push(`${where}：theoryTable 須為四欄字串陣列（JSON），或留空`); theoryTable = [];
  }
  const id = String(raw.id ?? '').trim() || `daily-${date}-${subject}-${index + 1}`;
  if (/[\s<>"'`]/.test(id) || id.length > 200) errors.push(`${where}：id「${id}」含空白或不允許的字元`);
  return {q: {id, date, subject, question, issues, outline: String(raw.outline ?? '').trim(), theoryTable,
    sourceReference: String(raw.sourceReference ?? raw.source ?? '').trim() || '使用者匯入；來源待核對',
    reviewStatus: String(raw.reviewStatus ?? '').trim() || '待核對', warnings: []}, errors};
}
function writeDaily(questions) {
  const abs = resolve(ROOT, DAILY_FILE);
  const prev = existsSync(abs) ? JSON.parse(readFileSync(abs, 'utf8')) : {};
  const data = {schemaVersion: 1, updatedAt: new Date().toISOString(), count: questions.length, questions,
    templates: Array.isArray(prev.templates) ? prev.templates : [], diagnostics: []};
  writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/generate-file-data.cjs'), '--write'], {stdio: 'ignore'});
}
function importDaily(file, flags) {
  const rows = readInput(file);
  const results = rows.map((r, i) => normalizeDaily(r, i));
  const errors = results.flatMap(r => r.errors);
  const seen = new Map();
  results.forEach((r, i) => { if (seen.has(r.q.id)) errors.push(`第 ${i + 1} 筆：id「${r.q.id}」與第 ${seen.get(r.q.id) + 1} 筆重複`); else seen.set(r.q.id, i); });
  if (errors.length) { console.error(`匯入中止，共 ${errors.length} 個問題：\n- ` + errors.join('\n- ')); process.exit(1); }
  let questions = results.map(r => r.q);
  if (flags.has('--merge')) {
    const abs = resolve(ROOT, DAILY_FILE), incoming = new Set(questions.map(q => q.id));
    const prev = existsSync(abs) ? JSON.parse(readFileSync(abs, 'utf8')).questions || [] : [];
    questions = [...prev.filter(q => !incoming.has(q.id)), ...questions];
  }
  if (flags.has('--dry-run')) { console.log(`檢查通過，未寫檔：每日模擬題 ${questions.length} 題`); return; }
  writeDaily(questions);
  console.log(`匯入完成：每日模擬題 ${questions.length} 題，離線資料已重建。`);
}

/* ---------- 第一試選擇題 ---------- */
export function normalizeMcq(raw, index) {
  const errors = [], where = `第 ${index + 1} 筆`;
  const body = String(raw.body ?? '').trim();
  const subject = String(raw.subject ?? '').trim();
  if (!body) errors.push(`${where}：缺少 body（題幹）`);
  if (!MCQ_SUBJECTS.includes(subject)) errors.push(`${where}：subject「${subject}」不是第一試科目（${MCQ_SUBJECTS.join('、')}）`);
  const options = list(raw.options);
  const status = String(raw.status ?? '').trim() || 'ok';
  if (!['ok', 'multi', 'incomplete'].includes(status)) errors.push(`${where}：status 只能是 ok、multi 或 incomplete`);
  if (status !== 'incomplete' && options.length !== 4) errors.push(`${where}：options 須有 4 個選項（選項殘缺的題目請標 status=incomplete）`);
  if (options.length > 4) errors.push(`${where}：options 最多 4 個`);
  const letter = x => /^[A-D]$/.test(x);
  const answer = raw.answer === null || raw.answer === undefined || raw.answer === '' ? null : String(raw.answer).trim();
  let accepted = Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers.map(x => String(x).trim()) : list(raw.acceptedAnswers);
  if (!accepted.length && answer) accepted = [answer];
  if (accepted.some(x => !letter(x)) || new Set(accepted).size !== accepted.length) errors.push(`${where}：acceptedAnswers 只能含不重複的 A–D`);
  if (status === 'ok' && !(letter(answer) && accepted.length === 1 && accepted[0] === answer)) errors.push(`${where}：status=ok 須有 A–D 單一正解`);
  if (status === 'multi' && !(letter(answer) && accepted.length >= 2 && accepted.includes(answer))) errors.push(`${where}：status=multi 須有 2 個以上 acceptedAnswers，且包含 answer`);
  if (status === 'incomplete' && (answer || accepted.length)) errors.push(`${where}：status=incomplete 不可有正解`);
  const yearRaw = String(raw.year ?? '').trim(), year = yearRaw === '' ? null : Number(yearRaw);
  if (yearRaw !== '' && !(Number.isInteger(year) && year > 0 && year < 300)) errors.push(`${where}：year 須為民國年度整數`);
  const noRaw = String(raw.questionNo ?? '').trim(), no = noRaw === '' ? null : Number(noRaw);
  if (noRaw !== '' && !(Number.isInteger(no) && no > 0)) errors.push(`${where}：questionNo 須為正整數`);
  const paper = String(raw.paper ?? '').trim() || null;
  if (paper && !MCQ_PAPERS.includes(paper)) errors.push(`${where}：paper 只能是 ${MCQ_PAPERS.join('、')}`);
  let exams = list(Array.isArray(raw.examTypes) ? raw.examTypes : String(raw.exam ?? '').replace(/、/g, ',')).flatMap(x => x.split(',')).map(x => x.trim()).filter(Boolean);
  if (!exams.length) exams = ['律師'];
  if (exams.some(x => !EXAMS.includes(x))) errors.push(`${where}：exam 只能是 律師 或 司法官`);
  const id = String(raw.id ?? '').trim() || ['mcq', year ?? 'x', paper ?? 'p', no ?? index + 1].join('-');
  if (/[\s<>"'`]/.test(id) || id.length > 200) errors.push(`${where}：id「${id}」含空白或不允許的字元`);
  const url = String(raw.sourceUrl ?? '').trim() || null;
  if (url && !/^https:\/\//.test(url)) errors.push(`${where}：sourceUrl 須為 https 網址`);
  return {errors, q: {id, year, no, subject, paper, exam: exams, body, options, answer, acceptedAnswers: accepted, status,
    answerNote: String(raw.answerNote ?? '').trim(), url}};
}
function readMcqBank() { return readGlobal(MCQ_FILE, 'MCQ_BANK') || []; }
function writeMcqBank(rows) {
  const head = '/* 由 scripts/import-questions.mjs --mcq 產生；請勿手動編輯。第一試選擇題，來源請自行核對（欄位說明見 docs/QUESTION_IMPORT.md）。 */';
  const body = rows.length ? '\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n' : '';
  writeFileSync(resolve(ROOT, MCQ_FILE), `${head}\nwindow.MCQ_BANK = [${body}];\n`, 'utf8');
}
function importMcq(file, flags) {
  const rows = readInput(file);
  const results = rows.map((r, i) => normalizeMcq(r, i));
  const errors = results.flatMap(r => r.errors);
  const seen = new Map();
  results.forEach((r, i) => { if (seen.has(r.q.id)) errors.push(`第 ${i + 1} 筆：id「${r.q.id}」與第 ${seen.get(r.q.id) + 1} 筆重複`); else seen.set(r.q.id, i); });
  if (errors.length) { console.error(`匯入中止，共 ${errors.length} 個問題：\n- ` + errors.slice(0, 40).join('\n- ') + (errors.length > 40 ? `\n（另有 ${errors.length - 40} 個）` : '')); process.exit(1); }
  let bank = results.map(r => r.q);
  if (flags.has('--merge')) { const incoming = new Set(bank.map(q => q.id)); bank = [...readMcqBank().filter(q => !incoming.has(q.id)), ...bank]; }
  const bad = bank.filter(q => q.status === 'incomplete').length;
  const summary = `第一試選擇題 ${bank.length} 題（其中 ${bad} 題選項或正解殘缺，不計分）`;
  if (flags.has('--dry-run')) { console.log('檢查通過，未寫檔：' + summary); return; }
  writeMcqBank(bank);
  console.log('匯入完成：' + summary + '。');
}

/* ---------- 主程式 ---------- */
function writeAll(main, related) {
  for (const f of MAIN_FILES) writeBank(f, 'QUESTION_BANK', main, BANK_HEADER);
  for (const f of RELATED_FILES) writeBank(f, 'RELATED_QUESTION_BANK', related, BANK_HEADER);
  writeBank(RECALL_FILE, 'RECALL_BANK', buildRecall(main, related), BANK_HEADER);
}
function current() {
  return {main: readGlobal(MAIN_FILES[0], 'QUESTION_BANK') || [], related: readGlobal(RELATED_FILES[0], 'RELATED_QUESTION_BANK') || []};
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const files = args.filter(a => !a.startsWith('--'));
  if (flags.has('--empty')) { writeAll([], []); writeDaily([]); writeMcqBank([]); console.log('已清空所有題庫（含每日模擬題、第一試選擇題），並重建主動回憶的作答方法練習。'); return; }
  if (flags.has('--mcq')) { if (files.length !== 1) { console.error('用法：node scripts/import-questions.mjs --mcq <檔案.json|檔案.csv> [--merge] [--dry-run]'); process.exit(2); } importMcq(files[0], flags); return; }
  if (flags.has('--daily')) { if (files.length !== 1) { console.error('用法：node scripts/import-questions.mjs --daily <檔案.json|檔案.csv>'); process.exit(2); } importDaily(files[0], flags); return; }
  if (flags.has('--rebuild-recall')) { const c = current(); writeBank(RECALL_FILE, 'RECALL_BANK', buildRecall(c.main, c.related), BANK_HEADER); console.log(`已依現有 ${c.main.length + c.related.length} 題重建主動回憶。`); return; }
  if (files.length !== 1) { console.error('用法：node scripts/import-questions.mjs <檔案.json|檔案.csv> [--merge] [--dry-run]'); process.exit(2); }
  const rows = readInput(files[0]);
  const results = rows.map((r, i) => normalize(r, i));
  const errors = results.flatMap(r => r.errors);
  const ids = new Map();
  results.forEach((r, i) => { if (ids.has(r.q.id)) errors.push(`第 ${i + 1} 筆：id「${r.q.id}」與第 ${ids.get(r.q.id) + 1} 筆重複`); else ids.set(r.q.id, i); });
  if (errors.length) { console.error(`匯入中止，共 ${errors.length} 個問題：\n- ` + errors.join('\n- ')); process.exit(1); }
  let mainBank = results.filter(r => r.bank === 'main').map(r => r.q);
  let relatedBank = results.filter(r => r.bank === 'related').map(r => r.q);
  if (flags.has('--merge')) {
    const c = current(), incoming = new Set(results.map(r => r.q.id));
    mainBank = [...c.main.filter(q => !incoming.has(q.id)), ...mainBank];
    relatedBank = [...c.related.filter(q => !incoming.has(q.id)), ...relatedBank];
  }
  const summary = `主要題庫 ${mainBank.length} 題、相關題庫 ${relatedBank.length} 題（本次讀入 ${rows.length} 筆）`;
  if (flags.has('--dry-run')) { console.log('檢查通過，未寫檔：' + summary); return; }
  writeAll(mainBank, relatedBank);
  console.log('匯入完成：' + summary + '。主動回憶已重建。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('匯入失敗：' + (e && e.message || e)); process.exit(1); });
}
