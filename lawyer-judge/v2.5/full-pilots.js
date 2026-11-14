/* Full question practice outlines (engine only). Lexical evidence is not correctness. */
(function(){
const checkedAt='2026-10-02',version='all-subject-pilot-v2-20261002';
const R={...window.LEGAL_PILOT_RUBRICS};
const S={};
for(const r of Object.values(window.CONTENT_STANDARDS||{}))if(r.source)S[r.source.url]={...r.source,checkedAt};
function source(key,title,url){S[key]={title,url,checkedAt};}
const category=['issue','issue','rule','rule','analysis','analysis'],weights=[15,15,13,12,13,12];
function add(id,title,src,lines,options={}){
const criteria=lines.map((line,i)=>{const [label,terms,hint]=line.split('~');return {category:category[i],weight:weights[i],label,groups:terms.split('&').map(g=>g.split('/')),hint,section:title};});
R[id]={title,version,checkedAt,legalVersion:'current',sections:title,sources:src.split(',').map(s=>S[s]),criteria,errors:[],changeNote:'依原題全部要求安排參考要點；其他合理學派、概念、論證與表達可人工覆核。',sourceNote:'非官方擬答與配分；文字規則只辨識論述線索，未經專家答案集校準。',...options};
}
// 律司版：原觀護人題目的評分要點已移除。新增題目的規則時，用 add(id,title,sourceKeys,lines,options) 登錄。
const choices={};
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[−－–]/g,'-').replace(/\s+/g,'');
const explanatory=/(?:是指|是|係指|因為|因此|所以|意味|代表|包括|屬於|可|能|須|應|得|不等於|不代表|不保證|非必然|不同|不能|避免|形成|影響|透過|有助|導致|說明|降低|增加|維持|理解|定義|提供|安排|探索|評估|建立|辨識|計算|等於|=)/;
const prose=s=>{const tokens=s.replace(/^[一二三四五六七八九十]+、/,'').trim().split(/[、，,\s]+/);return norm(s).length>=8&&!(tokens.length>=4&&tokens.filter(t=>t.length<=10).length/tokens.length>.8);};
const commonErrors=[];
const localErrors={};
function numbersCheck(){return [];}
window.FULL_PILOT_RUBRICS=R;
window.gradeFullPilot=(answer,q)=>{
if(window.LEGAL_PILOT_RUBRICS[q.id])return window.gradeLegalPilot(answer,q);
const r=R[q.id];if(!r)return null;
const text=String(answer||''),units=text.split(/[。；！？\n]+/).map(s=>s.trim()).filter(Boolean),paragraphs=text.split(/\n+/).filter(s=>s.trim());
const warnings=[];
for(const [pattern,hint] of [...commonErrors,...(localErrors[q.id]||[])]){const hit=units.find(s=>new RegExp(pattern,'i').test(norm(s))&&!/(?:錯誤說法|不能說|不應說|並非說|此說不正確)/.test(s));if(hit)warnings.push(hint+' 原句：'+hit);}
let evidence=r.criteria.map(row=>{const candidates=(r.sessions?[...units,...paragraphs]:units).filter(s=>row.groups.every(g=>g.some(t=>norm(s).includes(norm(t)))));const hit=candidates.find(s=>prose(s)&&explanatory.test(s));return {...row,status:hit?'evidence':candidates.length?'partial':'missing',evidence:hit||candidates[0]||'',ratio:hit?1:0};});
const substantive=units.some(s=>prose(s)&&explanatory.test(s))&&evidence.some(e=>e.ratio);
if(r.numeric&&substantive)warnings.push(...numbersCheck(r.numeric,units));
if(r.choice){
const rows=choices[r.choice].map(([aliases,definition])=>{const names=aliases.split('/'),mentions=units.filter(s=>names.some(n=>norm(s).includes(norm(n))));const unique=s=>choices[r.choice].filter(([a])=>a.split('/').some(n=>norm(s).includes(norm(n)))).length===1;
const found=mentions.find(s=>unique(s)&&prose(s)&&explanatory.test(s)&&definition.split('&').every(g=>g.split('/').some(t=>norm(s).includes(norm(t)))));
const example=mentions.find(s=>unique(s)&&prose(s)&&/(?:例如|例子|像是|比如|活動|讓成員|安排)/.test(s));return {label:names[0],defined:!!found,example:!!example,evidence:[found,example].filter(Boolean).join('；'),mentioned:mentions.some(s=>(prose(s)&&explanatory.test(s))||/(?:因子|概念)(?:包括|有|為)/.test(s))};});
const names=rows.filter(x=>x.mentioned).length,definitions=rows.filter(x=>x.defined).length,examples=rows.filter(x=>x.defined&&x.example).length;
evidence=evidence.map((e,i)=>{const count=i<2?names:i<4?definitions:examples;const required=i<2&&r.allChoices?11:5;return {...e,ratio:Math.min(1,count/required),status:count>=required?'evidence':count?'partial':'missing',evidence:rows.filter(x=>x.evidence).map(x=>x.label+'：'+x.evidence).join('\n'),hint:e.hint+' 已辨識'+count+'項／需要'+required+'項。'};});
if(r.allChoices&&names>0&&names<11)warnings.push('本題前段要求列全十一因子，尚未完整辨識，請人工覆核。');
}
if(r.sessions&&substantive){for(let i=1;i<=8;i++){const han=['','一','二','三','四','五','六','七','八'][i];const session=paragraphs.find(p=>new RegExp('第(?:'+i+'|'+han+')(?:次|週|堂)').test(p)&&norm(p).length>=12);if(!session)warnings.push('第'+i+'次單元尚未辨識完整內容，暫停試評。');}}
if(r.soap&&substantive)for(const letter of ['S','O','A','P']){const line=paragraphs.find(p=>new RegExp('^\\s*'+letter+'\\s*(?:[（(][^）)]*[）)])?\\s*[:：]','i').test(p)&&norm(p).length>=12);if(!line)warnings.push('SOAP範例的'+letter+'欄尚未完整辨識，需覆核。');}
if(r.selfRating&&substantive&&!/(?:自評|給自己|評為|評分|我給|分化程度|分數).{0,12}(?:100|[1-9]?\d)\s*分/.test(text))warnings.push('尚未辨識0至100分自評；自評高低不影響試評，請說明個人理由。');
if(r.familyFive&&substantive){const factors=['監督/監控','教養/管教','暴力/虐待','衝突/失和','依附/關係/支援','父母犯罪/家庭犯罪/成癮'];const count=factors.filter(a=>units.some(s=>a.split('/').some(t=>norm(s).includes(t))&&prose(s)&&explanatory.test(s))).length;if(count<5)warnings.push('五種不同家庭因素尚未完整辨識，其他合理分類請人工覆核。');}
if(r.openChoice&&substantive&&evidence.filter(e=>e.ratio).length<3)warnings.push('本題允許其他合理理論或見解；目前規則未完整辨識，請人工覆核。');
const alternate={};
if(alternate[q.id]?.test(text)&&units.some(s=>prose(s)&&explanatory.test(s)))warnings.push('已採其他可合理選擇的理論，請人工覆核；不以範例理論判為錯誤。');
const scores={issue:0,rule:0,analysis:0,structure:0};for(const e of evidence)scores[e.category]+=e.weight*e.ratio;
for(const k of Object.keys(scores))scores[k]=Math.round(scores[k]);
const covered=evidence.filter(e=>e.ratio>0).length;
if(covered){const heads=(text.match(/(?:^|\n)\s*(?:[一二三四五六七八九十]+、|\d+[.、]|[（(][一二三\d]+[）)])/g)||[]).length;scores.structure=Math.round(Math.min(20,Math.min(8,heads*2)+Math.min(6,Math.max(0,paragraphs.length-1)*2)+(/綜上|結論|因此|故/.test(text)?6:0))*Math.min(1,covered/3));}
if(warnings.length)evidence=evidence.map(e=>({...e,status:'manual'}));
return {scores:warnings.length?null:scores,total:warnings.length?null:Object.values(scores).reduce((a,b)=>a+b,0),method:'all-subject-pilot-v2',rubricVersion:version,legalVersion:r.legalVersion,checkedAt,answer:text,characters:norm(text).length,evidence,warnings,manualReview:warnings.length>0,
confidence:'文字規則試評；數字只反映已辨識要點與結構，不是正確率或官方分數，尚未經專家答案集校準。',strengths:evidence.filter(e=>e.status==='evidence').slice(0,4).map(e=>'已辨識：'+e.label),improvements:[...warnings,...evidence.filter(e=>e.status!=='evidence').slice(0,4).map(e=>e.hint)].slice(0,6),createdAt:new Date().toISOString()};
};
})();
