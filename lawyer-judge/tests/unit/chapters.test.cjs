#!/usr/bin/env node
/* 選擇題章節歸類（mcq/chapters.js）：條號與關鍵字歸類、使用者更正優先、交付題庫的歸類涵蓋率。 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..'),win={},ctx=vm.createContext({window:win});
for(const f of ['mcq/bank.js','mcq/chapters.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx);
const C=win.LSDeskMcqChapters,BANK=win.MCQ_BANK;
const q=(subject,body,options=[])=>({id:'t-'+Math.random(),subject,body,options});
const names=x=>C.autoTags(x).map(id=>C.nameOf(x.subject,id));
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m); // 題庫在另一個 vm 環境載入，陣列原型不同，所以比內容
const has=(x,part)=>names(x).some(n=>n.includes(part));

same(C.subjects(),['刑法','刑事訴訟法']);
assert.equal(C.has('民法'),false);same(C.chapters('民法'),[]);same(C.autoTags(q('民法','關於第184條')),[]);
for(const s of C.subjects()){const ids=C.chapters(s).map(c=>c.id);assert.equal(new Set(ids).size,ids.length,'chapter ids unique: '+s);assert(ids.length>=12);}

// 條號：落在哪一章的條文範圍
assert(has(q('刑法','依刑法第23條之規定，下列何者正確？'),'阻卻違法'));
assert(has(q('刑法','關於刑法第 339 條之 4 之敘述'),'財產犯罪'));
assert(has(q('刑法','第 271 條第 1 項之罪'),'生命身體'),'bare article number belongs to the subject');
assert(has(q('刑事訴訟法','依刑事訴訟法第159條之1'),'證據'));
assert(has(q('刑事訴訟法','依刑事訴訟法第455條之2'),'協商'));
// 別的法律的條號不拿來對照本科條文範圍
same(names(q('刑法','貪污治罪條例第5條之規定')),[]);
same(names(q('刑事訴訟法','依刑法第25條')),[]);
same(names(q('刑法','依刑事訴訟法第88條')),[]);
same(names(q('刑法','陸海空軍刑法第24條')),[]);
// 關鍵字，一題可以屬於好幾章
const multi=q('刑法','甲、乙共謀強盜，著手後因警察到場而未遂。',['甲乙成立強盜罪之共同正犯']);
for(const part of ['正犯與共犯','未遂','財產犯罪'])assert(has(multi,part),part);
assert(has(q('刑事訴訟法','警察未持搜索票，逕行搜索甲之住處並扣押毒品'),'搜索'));
assert(has(q('刑事訴訟法','關於傳聞法則之例外'),'證據'));
same(names(q('刑法','下列敘述何者正確？',['以上皆是'])),[]);

// 更正優先；空陣列表示移出所有章節；不存在的章節 id 會被忽略
const one=q('刑法','依刑法第23條');const auto=C.autoTags(one);
same(C.tagsOf(one,{}),auto);
same(C.tagsOf(one,{[one.id]:['cl-attempt','no-such','cp-search']}),['cl-attempt']);
same(C.tagsOf(one,{[one.id]:[]}),[]);
assert.equal(C.inChapter(one,C.UNSORTED,{[one.id]:[]}),true);
assert.equal(C.inChapter(one,'cl-justify',{}),true);
assert.equal(C.inChapter(one,'cl-justify',{[one.id]:['cl-attempt']}),false);
assert.equal(C.validOverrides({a:['cl-attempt']}),true);
for(const bad of [null,[],{a:'x'},{a:[1]},{a:Array(21).fill('x')}])assert.equal(C.validOverrides(bad),false);

// 交付題庫：兩科每一章都有題目，歸不進去的題目很少；各章題數加總與逐題歸類一致
for(const s of C.subjects()){
  const list=BANK.filter(x=>x.subject===s),counts=C.counts(s,list,{});
  assert(list.length>0,s+' has questions');
  for(const c of C.chapters(s))assert(counts[c.id]>0,s+' chapter has questions: '+c.name);
  assert(counts[C.UNSORTED]<=list.length*0.03,s+' unsorted share '+counts[C.UNSORTED]+'/'+list.length);
  const total=list.reduce((n,x)=>n+Math.max(1,C.autoTags(x).length),0);
  assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),total);
  for(const c of C.chapters(s))assert.equal(list.filter(x=>C.inChapter(x,c.id,{})).length,counts[c.id]);
  const avg=list.reduce((n,x)=>n+C.autoTags(x).length,0)/list.length;
  assert(avg<3,s+' average chapters per question stays below 3 ('+avg.toFixed(2)+')');
}
console.log('PASS mcq chapters: article ranges, keywords, overrides, bank coverage');
