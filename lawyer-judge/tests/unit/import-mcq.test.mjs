// 第一試選擇題：LawPlayer 轉換（科目、卷別、正解、殘缺題）與匯入腳本的驗證規則。
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {convertFile, parseAnswer} from '../../scripts/convert-lawplayer.mjs';
import {normalizeMcq} from '../../scripts/import-questions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => readFileSync(join(root, 'tests', 'fixtures', 'lawplayer', f), 'utf8');

// 卷四（商法）：科目順序為公司 15、保險 10、票據 10、證交 10、強執 10、法學英文 15（107–115 年各卷逐題核對過）
const c4 = convertFile(read('107-commercial-mcq.txt'));
assert.equal(c4.kind, 'stage1');
assert.equal(c4.questions.length, 70);
const sub = {};
for (const q of c4.questions) sub[q.subject] = (sub[q.subject] || 0) + 1;
assert.deepEqual(sub, {公司法: 15, 保險法: 10, 票據法: 10, 證券交易法: 10, 強制執行法: 10, 法學英文: 15});
assert.equal(c4.questions[35].subject, '證券交易法');
assert.equal(c4.questions[45].subject, '強制執行法');
assert.ok(c4.questions.every(q => q.paper === '卷四'));
const incomplete = c4.questions.filter(q => q.status === 'incomplete');
assert.equal(incomplete.length, 11, '殘缺題數');
assert.ok(incomplete.every(q => q.answer === null && q.options.length === 0 && q.acceptedAnswers.length === 0), '殘缺題不留碎片選項、不給正解');
assert.ok(c4.warnings.some(w => /第 11 題選項或正解不完整，標為不計分/.test(w)));
const multi = c4.questions.find(q => q.questionNo === 19);
assert.deepEqual([multi.status, multi.answer, multi.acceptedAnswers], ['multi', 'B', ['B', 'C']], '官方更正均給分');

// 卷二：憲法 20 → 行政法 35 → 國際公法 10 → 國際私法 10
const c2 = convertFile(read('107-comprehensive-law-1-constitutional.txt'));
assert.deepEqual([c2.questions[19].subject, c2.questions[20].subject, c2.questions[54].subject, c2.questions[55].subject, c2.questions[65].subject], ['憲法', '行政法', '行政法', '國際公法', '國際私法']);
assert.equal(c2.questions[35].status, 'multi');

// 正解判讀
assert.deepEqual(parseAnswer('C', 4), {answer: 'C', acceptedAnswers: ['C'], status: 'ok', answerNote: ''});
assert.equal(parseAnswer('', 4).status, 'incomplete');
assert.equal(parseAnswer('C', 3).status, 'incomplete', '選項不足 4 個');
assert.equal(parseAnswer('B 或 D（官方更正，均給分）', 4).acceptedAnswers.join(), 'B,D');
assert.equal(parseAnswer('B 或 D', 4).status, 'incomplete', '看不出是官方更正就不猜');

// 轉換結果全部通過匯入驗證
for (const q of [...c4.questions, ...c2.questions]) assert.deepEqual(normalizeMcq(q, 0).errors, [], q.id);

// 匯入驗證規則
const base = {body: '題幹', subject: '民法', options: ['甲', '乙', '丙', '丁'], answer: 'B', year: 110, questionNo: 1, paper: '卷三'};
const bad = (patch, re) => assert.ok(normalizeMcq({...base, ...patch}, 0).errors.some(e => re.test(e)), JSON.stringify(patch));
assert.deepEqual(normalizeMcq(base, 0).errors, []);
bad({subject: '國文'}, /不是第一試科目/);
bad({subject: '智慧財產法'}, /不是第一試科目/);
bad({options: ['甲', '乙', '丙']}, /須有 4 個選項/);
bad({options: ['甲', '乙', '丙', '丁', '戊']}, /最多 4 個/);
bad({answer: 'E'}, /單一正解/);
bad({answer: null}, /單一正解/);
bad({status: 'multi', answer: 'A', acceptedAnswers: ['A']}, /2 個以上/);
bad({status: 'incomplete', options: [], answer: 'A'}, /不可有正解/);
bad({status: 'weird'}, /status 只能是/);
bad({paper: '卷五'}, /paper 只能是/);
bad({sourceUrl: 'http://x.test'}, /https/);
bad({year: 'abc'}, /year/);
assert.deepEqual(normalizeMcq({...base, status: 'multi', answer: 'A', acceptedAnswers: ['A', 'C']}, 0).errors, []);
assert.deepEqual(normalizeMcq({...base, status: 'incomplete', options: [], answer: null}, 0).errors, []);
assert.deepEqual(normalizeMcq({...base, options: '甲|乙|丙|丁'}, 0).q.options, ['甲', '乙', '丙', '丁'], 'CSV 用 | 分隔');

// 指令列：重複 id 與乾跑不寫檔
const tmp = mkdtempSync(join(tmpdir(), 'mcq-test-'));
try {
  const file = join(tmp, 'dup.json');
  writeFileSync(file, JSON.stringify([{...base, id: 'x-1'}, {...base, id: 'x-1'}]));
  const r = spawnSync(process.execPath, [join(root, 'scripts/import-questions.mjs'), '--mcq', file, '--dry-run'], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /id「x-1」與第 1 筆重複/);
  writeFileSync(file, JSON.stringify([{...base, id: 'x-1'}, {...base, id: 'x-2', questionNo: 2}]));
  const ok = spawnSync(process.execPath, [join(root, 'scripts/import-questions.mjs'), '--mcq', file, '--dry-run'], {encoding: 'utf8'});
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /檢查通過，未寫檔：第一試選擇題 2 題/);
} finally { rmSync(tmp, {recursive: true, force: true}); }

console.log('PASS 第一試選擇題：卷四科目順序、卷別、正解（單一／更正均給分／殘缺）、匯入驗證規則');
