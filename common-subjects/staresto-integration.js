/* v0.3: External references to staresto-create. No cross-origin question extraction or score sync. */
(function(){
'use strict';
var resources=Array.isArray(window.STARESTO_STUDY_RESOURCES)?window.STARESTO_STUDY_RESOURCES:[];
var api=window.CommonSubjectsIntegration;
if(!api||!document.getElementById('resourceCards'))return;
var $=function(id){return document.getElementById(id)};
var labels={vocab:'單字與字詞搭配',grammar:'文法與克漏字',reading:'閱讀理解'};
function textEl(tag,value,klass){
 var node=document.createElement(tag);
 if(klass)node.className=klass;
 node.textContent=value;
 return node;
}
function getData(){
 var x=api.getData();
 return x&&typeof x==='object'?x:{history:{},kinds:[],externalPractice:{}};
}
function weakness(){
 var data=getData(),points={vocab:0,grammar:0,reading:0};
 Object.entries(data.history||{}).forEach(function(entry){
  var key=entry[0],rows=entry[1];
  if(!key.startsWith('e')||!Array.isArray(rows)||!rows.length||rows[rows.length-1].correct)return;
  var i=Number(key.substring(1));
  if(!Number.isInteger(i)||i<0)return;
  var kind=data.kinds[i];
  var category=(kind==='cloze'||kind==='grammar')?'grammar':kind;
  if(Object.prototype.hasOwnProperty.call(points,category))points[category]++;
 });
 var order=Object.keys(points).sort(function(a,b){return points[b]-points[a]});
 var best=order[0];
 if(!points[best])return {category:'vocab',message:'目前沒有尚未答對的題型，建議先從學測單字題開始建立基礎，再進入文法與閱讀。'};
 return {category:best,message:'依本站目前仍答錯的題目，建議先補強「'+labels[best]+'」（'+points[best]+' 題）。外站作答結果不會自動回傳。'};
}
function sessionCount(obj){
 return Object.values(obj||{}).reduce(function(sum,rows){return sum+(Array.isArray(rows)?rows.length:0)},0);
}
function renderRecords(){
 var node=$('externalRecordsStat');if(!node)return;
 var total=sessionCount(getData().externalPractice);
 node.textContent='外部延伸練習：'+total+' 次（自行確認完成，不計入本站正確率）';
}
function render(){
 var filter=$('resourceFilter').value;
 var rec=weakness(),data=getData(),host=$('resourceCards');
 $('resourceRecommendation').textContent=rec.message;
 $('resourceCount').textContent='本站已手動登記外部練習 '+sessionCount(data.externalPractice)+' 次。練習次數由你自己確認，不是外部站點提供的成績。';
 host.replaceChildren();
 resources.filter(function(r){return filter==='all'||r.category===filter})
 .sort(function(a,b){return Number(b.category===rec.category)-Number(a.category===rec.category)})
 .forEach(function(r){
  if(!r||typeof r.url!=='string'||!r.url.startsWith('https://staresto-create.github.io/'))return;
  var card=textEl('article','', 'ext-resource');
  card.append(textEl('h4',r.title));
  card.append(textEl('div',r.level+(r.category===rec.category?' · 建議優先':''),'ext-level'));
  card.append(textEl('p',r.description));
  var acts=textEl('div','', 'ext-actions');
  var a=textEl('a','開啟原站練習 ↗','btn primary');
  a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';acts.append(a);
  var done=textEl('button','我已完成一次','btn');
  done.type='button';
  done.addEventListener('click',function(){
    api.mark(r.id,r.url);
    render();renderRecords();
  });
  acts.append(done);card.append(acts);
  var list=data.externalPractice&&data.externalPractice[r.id];
  card.append(textEl('p','自我記錄：'+(Array.isArray(list)?list.length:0)+' 次','small'));
  host.append(card);
 });
 renderRecords();
}
$('resourceFilter').addEventListener('change',render);
$('tabEnglish').addEventListener('click',render);
$('tabRecords').addEventListener('click',renderRecords);
renderRecords();
})();
