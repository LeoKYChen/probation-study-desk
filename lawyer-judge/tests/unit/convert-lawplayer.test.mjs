// LawPlayer 試卷 .txt 轉換的回歸測試。樣本為考選部試題（著作權法第 9 條第 1 項第 5 款），由 LawPlayer 整理、使用者下載提供。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {convertFile, dedupeStatutes} from '../../scripts/convert-lawplayer.mjs';
import {normalize} from '../../scripts/import-questions.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'lawplayer');
const read = f => readFileSync(join(dir, f), 'utf8');

// 第二試申論：LawPlayer 把參考法條中的「二、」誤當成第 2 題，必須還原並重新切題
const essay = convertFile(read('114-constitutional-administrative-law.txt'));
assert.equal(essay.kind, 'stage2');
assert.deepEqual(essay.warnings, []);
assert.equal(essay.questions.length, 2);
const [q1, q2] = essay.questions;
assert.equal(q1.subject, '憲法與行政法');
assert.equal(q1.year, 114);
assert.equal(q1.id, 'lawplayer-114-constitutional-administrative-law-1');
assert.equal(q1.sourceUrl, 'https://lawplayer.com/exam/lawyer/114-constitutional-administrative-law');
assert.match(q1.body, /^甲公司為藥商/, 'question number prefix removed');
assert.match(q1.body, /二、藥品或醫療器材製造業者。/, 'numbering eaten by LawPlayer split is restored');
assert.match(q1.body, /第92條第4項\n違反第六十六條第一項[^\n]*二十萬元以上五百萬元以下罰鍰。$/, 'last statute line kept');
assert.match(q1.body, /違反藥事法第66條第1項規定，依藥事法第92條第4項規定對之裁處新臺幣（下同）100萬元/, 'hard wraps joined');
assert.match(q1.body, /㈢[^\n]+（40分）\n/, 'sub-question with score on one line');
assert.match(q2.body, /^甲直轄市為保障該市外送員/);
assert.match(q2.body, /丁之主張有無理由？（30分）\n/, 'lone score line joined');
assert.equal((q2.body.match(/〈職業安全衛生法〉/g) || []).length, 1, 'duplicated statute block removed');
assert.equal((q2.body.match(/〈強制汽車責任保險法〉/g) || []).length, 1);
assert.doesNotMatch(q2.body, /\(二\)\s*直轄市\n勞工安全衛生/, 'stray fragment removed');
assert.doesNotMatch(q1.body + q2.body, /第\s*\d+\s*題/, 'no LawPlayer split markers left');
for (const q of essay.questions) assert.deepEqual(normalize(q, 0).errors, [], 'converted essay passes the importer');

// 殘句規則只在確實刪除重複段落後才作用：一般法條結尾不得被誤刪
assert.deepEqual(dedupeStatutes(['第91條', '處新臺幣二十萬元以上罰鍰。', '第92條', '處新臺幣二十萬元以上罰鍰。']).length, 4);

// 參考法條的列舉款次被 LawPlayer 標成「第 N 題」：只有之後出現配分、且中間沒有條號的「N、」才算新題
const c113 = convertFile(read('113-constitutional-administrative-law.txt'));
assert.deepEqual(c113.warnings, []);
assert.equal(c113.questions.length, 2);
assert.equal(c113.scoreSum, 200);
assert.match(c113.questions[1].body, /^坐落於甲直轄市（非總量管制區）轄內的乙火力發電廠/);
assert.doesNotMatch(c113.questions[0].body.split('【參考法條】')[0], /^重度肢障。$/m);

const labor = convertFile(read('114-labor-social-law.txt'), {subject: '勞動社會法'});
assert.deepEqual(labor.warnings, []);
assert.deepEqual(labor.questions.map(q => q.body.slice(0, 6)), ['A 受僱於B', '甲企業工會（', 'A 國際金融']);
assert.equal(labor.scoreSum, 100);

// LawPlayer 原卷缺第 2 題、開頭混入他題法條：刪除開頭法條，並以配分合計提出警告（不得自行補題）
const c112 = convertFile(read('112-constitutional-administrative-law.txt'));
assert.equal(c112.questions.length, 1);
assert.match(c112.questions[0].body, /^原住民甲與乙比鄰而居住於A 縣/);
assert.equal(c112.scoreSum, 100);
assert.ok(c112.warnings.some(w => /開頭有 \d+ 行疑似其他題的參考法條/.test(w)));
assert.ok(c112.warnings.some(w => /配分合計 100 分，與滿分 200 分不符/.test(w)));

// 第一試選擇題：選項、正解與依配分推定的科目
const mcq = convertFile(read('115-comprehensive-law-1-criminal.txt'));
assert.equal(mcq.kind, 'stage1');
assert.deepEqual(mcq.warnings, []);
assert.equal(mcq.questions.length, 75);
assert.ok(mcq.questions.every(q => q.options.length === 4 && /^[A-D]$/.test(q.answer)));
const count = {};
for (const q of mcq.questions) count[q.subject] = (count[q.subject] || 0) + 1;
assert.deepEqual(count, {刑法: 35, 刑事訴訟法: 25, 法律倫理: 15});
assert.equal(mcq.questions[35].subject, '刑事訴訟法');
assert.match(mcq.questions[35].body, /管轄|起訴|法院/);
assert.equal(mcq.questions[60].subject, '法律倫理');
assert.match(mcq.questions[60].body, /倫理/);
assert.equal(mcq.questions[0].answer, 'D');
assert.ok(normalize(mcq.questions[0], 0).errors.some(e => /第二試申論題/.test(e)), 'stage-1 questions are refused by the importer with a reason');

console.log('PASS LawPlayer converter: 114/113/112 憲行 + 114 勞社 essays (restored numbering, statute enumerations not split, leading statutes stripped, score-sum check), 75 MCQs (35/25/15), importer compatibility');
