/* Knowledge Graph preview model: original subject/topic/row links only. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.KnowledgeGraphModel=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const CROSS=['少年事件處理法','刑法','刑事訴訟法','保安處分執行法'];
  const EXCLUDED=['國文','法學知識與英文','社會工作概論'];
  const visibleSubjects=subjects=>(subjects||[]).filter(s=>s&&!EXCLUDED.includes(s.subject));
  const text=x=>String(x==null?'':x).trim();
  const safeUrl=value=>/^https:\/\/[^/\s]+(?:\/|$)/i.test(text(value))?text(value):'';
  const normNo=n=>text(n);
  function findQuestion(bank,subject,row){
    const exactSubject=subject.practiceSubject||subject.subject;
    return (bank||[]).find(q=>
      Number(q.year)===Number(row.year)&&normNo(q.questionNo)===normNo(row.no)&&
      q.subject===exactSubject&&
      (q.examType==='觀護人'||(Array.isArray(q.examTypes)&&q.examTypes.includes('觀護人')))
    )||null;
  }
  function mappedRow(subject,row,bank,topicLabel){
    const q=findQuestion(bank,subject,row);
    return {
      year:row.year,no:row.no,keywords:text(row.keywords),core:text(row.core),
      secondary:text(row.secondary),ability:text(row.ability),
      topic:topicLabel,subject:subject.subject,questionId:q?q.id:null,
      questionTitle:q?text(q.title):'',
      sourceUrl:safeUrl(row.sourceUrl)||safeUrl(q&&q.sourceUrl),
      studyNotes:Array.isArray(row.studyNotes)?row.studyNotes:[],
      matchStatus:q?'題庫精確對應':'題庫尚未確認對應'
    };
  }
  function buildGraph(subjects,bank,options){
    options=options||{};
    const cross=Boolean(options.cross);
    const allowed=visibleSubjects(subjects);
    const chosen=cross?allowed.filter(s=>CROSS.includes(s.subject)):
      allowed.filter(s=>s.subject===(options.subject||'少年事件處理法'));
    const query=text(options.search).toLocaleLowerCase('zh-Hant');
    const maxTopics=options.maxTopics|| (cross?10:26);
    const maxRowsPerTopic=options.maxRowsPerTopic|| (cross?2:3);
    const maxQuestions=options.maxQuestions|| (cross?72:80);
    const nodes=[],edges=[],lookup=new Map(),edgeIds=new Set();
    const addNode=n=>{if(!lookup.has(n.id)){lookup.set(n.id,n);nodes.push(n);}return lookup.get(n.id);};
    const addEdge=(a,b,type)=>{
      const id=a+'|'+b+'|'+type;
      if(!edgeIds.has(id)){edgeIds.add(id);edges.push({id,source:a,target:b,type});}
    };
    let shownTopics=0,hiddenTopics=0,hiddenRows=0;
    for(const subject of chosen){
      const sid='subject:'+subject.subject;
      addNode({id:sid,label:subject.subject,type:'subject',subject:subject.subject,count:subject.rows?.length||0,detail:subject.scope||''});
      const topics=(subject.topics||[]).filter(t=>{
        if(!query)return true;
        return [t.label,...(t.rows||[]).flatMap(r=>[r.core,r.secondary,r.keywords,String(r.year)])]
          .some(item=>text(item).toLocaleLowerCase('zh-Hant').includes(query));
      });
      const shown=topics.slice(0,maxTopics);
      hiddenTopics+=Math.max(0,topics.length-shown.length);
      for(const topic of shown){
        shownTopics++;
        const tid='topic:'+subject.subject+':'+topic.label;
        const rows=Array.isArray(topic.rows)?topic.rows:[];
        addNode({id:tid,label:topic.label,type:'topic',subject:subject.subject,
          count:Number(topic.count)||rows.length,detail:topic.kind||'',topic:topic.label,
          rows:rows.map(r=>mappedRow(subject,r,bank,topic.label))});
        addEdge(sid,tid,'所屬分類');
        const sorted=rows.slice().sort((a,b)=>Number(b.year)-Number(a.year));
        let shownInTopic=0;
        for(const r of sorted){
          if(shownInTopic>=maxRowsPerTopic){hiddenRows++;continue;}
          const mapped=mappedRow(subject,r,bank,topic.label);
          const id=mapped.questionId?'question:'+mapped.questionId:
            'unmatched:'+subject.subject+':'+text(r.year)+':'+normNo(r.no);
          if(!lookup.has(id) && nodes.filter(n=>n.type==='question').length>=maxQuestions){hiddenRows++;continue;}
          const n=addNode({id,label:text(r.year)+'年第'+normNo(r.no)+'題',type:'question',
            subject:subject.subject,count:1,matched:Boolean(mapped.questionId),rows:[]});
          if(!n.rows.some(x=>x.subject===mapped.subject&&x.topic===mapped.topic&&
               x.year===mapped.year&&normNo(x.no)===normNo(mapped.no)))n.rows.push(mapped);
          addEdge(tid,id,'考點對應題次');
          shownInTopic++;
        }
      }
    }
    const sharedQuestions=nodes.filter(n=>n.type==='question'&&
      new Set(n.rows.map(r=>r.subject)).size>1);
    return {nodes,edges,stats:{subjects:chosen.length,topics:shownTopics,
      questions:nodes.filter(n=>n.type==='question').length,
      matched:nodes.filter(n=>n.type==='question'&&n.matched).length,
      sharedQuestions:sharedQuestions.length,hiddenTopics,hiddenRows},
      cross,query,chosenSubjects:chosen.map(s=>s.subject)};
  }
  return {CROSS,EXCLUDED,visibleSubjects,findQuestion,buildGraph,safeUrl,mappedRow};
});
