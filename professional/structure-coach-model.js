/* Phase 1: pure, backwards-compatible model for the optional 30-minute structure coach. */
(function(root){
  'use strict';
  const ROLES=['premise','issue','supplement','conclusion'];
  const MAX_TEXT=12000;
  const empty=()=>({
    version:1,facts:'',coreQuestion:'',prerequisites:'',
    outline:[{title:'',question:'',role:'premise'},{title:'',question:'',role:'issue'}],
    paragraph:{issue:'',rule:'',application:'',conclusion:'',combined:''},
    checks:[false,false,false,false,false],weakness:'',nextGoal:''
  });
  const clean=(s,limit=MAX_TEXT)=>typeof s==='string'?s.slice(0,limit):'';
  function normalize(value){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const base=empty(), p=source.paragraph&&typeof source.paragraph==='object'?source.paragraph:{};
    const outline=Array.isArray(source.outline)?source.outline.slice(0,8).map(item=>({
      title:clean(item?.title,300),question:clean(item?.question,600),
      role:ROLES.includes(item?.role)?item.role:'issue'
    })):[];
    return {
      version:1,facts:clean(source.facts),coreQuestion:clean(source.coreQuestion),
      prerequisites:clean(source.prerequisites),
      outline:outline.length?outline:base.outline,
      paragraph:{issue:clean(p.issue),rule:clean(p.rule),application:clean(p.application),
        conclusion:clean(p.conclusion),combined:clean(p.combined)},
      checks:Array.from({length:5},(_,i)=>source.checks?.[i]===true),
      weakness:clean(source.weakness,2000),nextGoal:clean(source.nextGoal,2000)
    };
  }
  function valid(source){
    if(!source||typeof source!=='object'||Array.isArray(source))return false;
    for(const key of ['facts','coreQuestion','prerequisites','weakness','nextGoal']){
      if(typeof source[key]!=='string'||source[key].length>(['weakness','nextGoal'].includes(key)?2000:MAX_TEXT))return false;
    }
    if(!Array.isArray(source.outline)||source.outline.length<1||source.outline.length>8)return false;
    if(!source.outline.every(o=>o&&typeof o.title==='string'&&o.title.length<=300&&typeof o.question==='string'&&o.question.length<=600&&ROLES.includes(o.role)))return false;
    if(!source.paragraph||typeof source.paragraph!=='object'||!['issue','rule','application','conclusion','combined'].every(k=>typeof source.paragraph[k]==='string'&&source.paragraph[k].length<=MAX_TEXT))return false;
    if(!Array.isArray(source.checks)||source.checks.length!==5||!source.checks.every(v=>typeof v==='boolean'))return false;
    return true;
  }
  const filled=s=>typeof s==='string'&&s.trim().length>0;
  function hasActivity(raw){
    const s=normalize(raw);
    return [s.facts,s.coreQuestion,s.prerequisites,s.weakness,s.nextGoal,
      ...Object.values(s.paragraph),...s.outline.flatMap(o=>[o.title,o.question])].some(filled)||
      s.checks.some(Boolean);
  }
  function readyForPhase(phase,raw){
    const s=normalize(raw);
    if(phase===0)return [s.facts,s.coreQuestion,s.prerequisites].every(filled);
    if(phase===1)return s.outline.filter(o=>filled(o.title)&&filled(o.question)).length>=2;
    if(phase===2)return ['issue','rule','application','conclusion'].every(k=>filled(s.paragraph[k]));
    if(phase===3)return filled(s.weakness)&&filled(s.nextGoal);
    return false;
  }
  const promptForPhase=[
    '請填寫重要事實或現象、一句核心問題，以及回答前須確認的事項。',
    '至少安排兩個論述區塊：每張卡片要有標題與「本段要回答的問題」。',
    '請完成問題、規範或理論、具體涵攝或案例應用、結論；不確定時可標示待查。',
    '請記錄一個最主要的結構弱點及下次的具體改善目標。'
  ];
  root.Study30StructureCoachModel={empty,normalize,valid,hasActivity,readyForPhase,promptForPhase,ROLES};
})(typeof window!=='undefined'?window:globalThis);
