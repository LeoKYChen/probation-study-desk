/* 108–115 全站心理學／心理測驗考古題：命題方式研究試作
 * 以已載入的原始題幹為唯一擷取依據；命題意圖屬推論，非官方閱卷標準。
 * 不修改題庫、題目 ID、評分、AI 教練或作答紀錄。
 */
(function (root) {
  'use strict';
  const TARGETS = new Set(['心理學','心理測驗']);
  const $ = id => document.getElementById(id);
  const clean = s => String(s || '').replace(/\s+/g,' ').trim();
  const unique = arr => [...new Set(arr.filter(Boolean))];

  const domains = [
    ['心理測驗與心理衡鑑',/心理測驗|測驗編製|心理衡鑑|信度|效度|常模|智力測驗|量表|鑑別度|測驗分數|百分等級|標準分數|標準誤|投射測驗|Z 分數|T 分數|IQ 成績|SAT|WAIS/i],
    ['發展心理學',/青少年|兒童|嬰兒|依附|發展階段|人生全程|道德發展|童年|Erikson|Elkind|Piaget|Kohlberg|鮑比|前額葉皮質/i],
    ['記憶與認知心理學',/記憶|遺忘|注意力|認知偏誤|捷思|思考模式|知覺|功能固著|創造力|意識狀態|認知評估|決策|認知處理/i],
    ['社會心理學',/團體|群體|從眾|去個人化|旁觀者|順從|社會認知|印象形成|相對剝奪|人際吸引|社會性散漫|強制說服/i],
    ['學習與動機心理學',/學習理論|行為型塑|增強|處罰|動機|自我效能|觀察學習|Bandura|古典條件|操作條件|過度辯證|損失規避/i],
    ['人格與心理健康',/人格|精神分析|Freud|防衛機制|壓力|創傷|PTSD|異常|憂鬱|情緒|焦慮|睡眠|成癮|自閉症|心理病理|幸福感/i],
    ['生理與神經心理學',/腦部|神經|生理因素|葡萄糖|飢餓|飽足|猝睡症/i]
  ];
  const verbs = [
    ['概念辨識與判斷',/請問|最符合|何者|有那些|有哪些|那些|哪些|列出|列舉|寫出|屬於|何謂/],
    ['指定理論運用',/請.{0,30}理論|以.{0,30}理論|根據.{0,30}理論|選.{0,12}理論|從.{0,60}觀點|依.{0,30}學派|理論.{0,20}分析|理論.{0,20}說明|提出.{0,20}理論/],
    ['比較辨析',/比較|異同|差異|有何不同|區分/],
    ['概念與理論說明',/何謂|定義|意涵|意義|內容|概念|試述|闡述|說明|詳述|列舉|寫出/],
    ['成因與機制分析',/分析|解釋|為何|原因|機制|如何影響|作用|形成|歸因|影響/],
    ['案例／情境應用',/舉例|實例|為例|案例|個案|假設|假想|情境|應用/],
    ['改善／處遇策略',/改善|改進|矯正|介入|處遇|輔導|因應|預防|方法|策略|調節|提升|解決/],
    ['數值計算與分數判讀',/計算|數值|GPA|百分等級|Z 分數|T 分數|信賴區間|標準差|鑑別度|難度（P）/],
    ['測驗與評估判斷',/衡鑑|評估|測驗|常模|效度|信度|量表|評析|倫理/]
  ];
  const askPattern = /請|試問|試述|試以|何謂|如何|為何|那些|哪些|有何|說明|分析|比較|分述|論述|計算|解釋|提出|闡述|評析|列舉|舉例/;
  function scope(q) {
    return !!q && TARGETS.has(q.subject) && Number(q.year) >= 108 && Number(q.year) <= 115;
  }
  function domain(q) {
    const body = clean(q.body);
    if (q.subject === '心理測驗') return '心理測驗與心理衡鑑';
    if(/請解釋下面專有詞彙|請試述下列名詞|下列名詞之意涵/.test(body))return '跨領域心理學名詞';
    return (domains.find(([label,re])=>re.test(body)) || ['心理學（領域待細分）'])[0];
  }
  function actions(body) {
    return verbs.filter(([,re])=>re.test(body)).map(([label])=>label);
  }
  function questions(body) {
    const original=clean(body);
    // 子題優先：多問的資料題必須保留全部子題，不能被冗長案例背景擠掉。
    const numbered=/(（[一二三四五六七八]）|㈠|㈡|㈢|㈣|㈤|⑴|⑵|⑶|⑷)/;
    if(numbered.test(original)) {
      const sections=original.split(/(?=（[一二三四五六七八]）|㈠|㈡|㈢|㈣|㈤|⑴|⑵|⑶|⑷)/)
        .map(clean).filter(s=>/^(（[一二三四五六七八]）|㈠|㈡|㈢|㈣|㈤|⑴|⑵|⑶|⑷)/.test(s));
      const areOnlyNumericFacts=sections.length>0 && sections.every(s=>!askPattern.test(s) && /分數|平均|標準差|關聯強度|常模數據/.test(s));
      if(sections.length && !areOnlyNumericFacts) {
        const items=sections.slice(0,8).map(s=>s.length>270?s.slice(0,260)+'…（請回看完整題幹）':s);
        return items.map(s=>s.length<25?'題目子項：'+s+'（須配合原題主問作答）':s);
      }
    }
    const normalized=original.replace(/([。？！；])/g,'$1\n');
    const pieces=normalized.split(/\n/).map(clean).filter(Boolean);
    const demands=pieces.filter(s=>askPattern.test(s))
      .map(s=>s.replace(/^\s*[一二三四五六][、．]/,'').replace(/^["”」]\s*/, '').trim())
      .filter(s=>s.length>4);
    const chosen=unique(demands).slice(0,6);
    if(!chosen.length) {
      const firstQuestion=original.indexOf('？');
      if(firstQuestion>=0) return [original.slice(0,firstQuestion+1), '如原題另有統計資料、分數或計算條件，須使用原題所給的資料進行推論；此處不提供計算答案。'];
      return [original.slice(-230)+'（請對照完整原題）'];
    }
    return chosen.map(s=>s.length>270?s.slice(0,260)+'…（請回看完整題幹）':s);
  }
  function mode(q, moves) {
    const b=clean(q.body);
    const givenContext=/個案|案例|某研究者|某標準化|小明|小敏|小玖|阿宏|阿明|阿丸|品明|甲生|乙生|受保護管束|請假想|假設|下列情境|下列試題|情境中的|某機構|某企業|您在|您是|17\s*歲|14\s*歲/.test(b);
    const compared=moves.includes('比較辨析');
    return givenContext && compared ? '混合型（情境＋比較）' : givenContext ? '個案／情境型' : '理論／知識型';
  }
  function risks(moves) {
    const r=[];
    if(moves.includes('概念辨識與判斷'))r.push('要寫出題目指定的心理現象或概念名稱，並說明判斷依據。');
    if(moves.includes('比較辨析'))r.push('不要只分別背誦定義，須沿相同比較基準交代異同。');
    if(moves.includes('數值計算與分數判讀'))r.push('不能只列出公式或數字；須呈現計算步驟、數值意義與推論限制。');
    if(moves.includes('案例／情境應用'))r.push('不能只背理論，應逐項連結題示的事實或情境。');
    if(moves.includes('改善／處遇策略'))r.push('不能只寫「加強輔導」；建議須與選用理論的作用機制相互對應。');
    if(moves.includes('測驗與評估判斷'))r.push('需區分測量結果、解釋範圍及效度／倫理限制，不得僅由分數推斷個案人格或診斷。');
    if(moves.includes('成因與機制分析'))r.push('不能只羅列可能因素，應說明各因素與心理機制之間的關係。');
    return r.length?r.slice(0,4):['對照原題每一問作答，不要以一般心理學常識取代題目指定的概念與範圍。'];
  }
  function analyze(q) {
    if(!scope(q)) return null;
    const note = root.PsychologyExamCurated?.[q.id];
    if(note && Array.isArray(note.r) && note.r.length) {
      const acts = actions(note.r.join(' '));
      const kind = note.k || mode(q, acts);
      return {
        id:q.id, domain:note.d, kind, actions:acts,
        requirements:note.r,
        structure:[
          '主要知識領域：'+note.d+'；題目載體：'+kind+'。',
          '原題的命題結構：'+note.s+'。',
          '從命題者角度反向練習：保留本題指定的作答動作及必要數量，再替換合適的材料或情境；不得把不同學說混成同一理論。'
        ],
        tested:[
          '題幹所指向的核心能力：'+note.c,
          '容易漏答／混淆之處：'+note.p,
          '命題意圖屬分析者推論，不是考選部命題委員說明，也不是唯一標準答案；請回到原題逐項作答。'
        ],
        reviewStatus:'已依平臺題幹逐題整理命題分析；尚未全部與考選部原卷逐字及獨立教材逐條校對。非官方標準答案。'
      };
    }
    const body=clean(q.body), req=questions(q.body), mv=actions(req.join(' ')), subjectDomain=domain(q), kind=mode(q,mv);
    const structure=mv.length?mv.slice(0,5).join(' → '):'辨識題目核心概念 → 按設問作答';
    const lead = '本題以「'+subjectDomain+'」為主要知識領域，採「'+kind+'」問法。';
    const analysis = [
      lead,
      '題幹可觀察的作答結構：'+structure+'。這是依題目動詞與情境所作的分類，並非官方題型名稱。',
      '反向命題練習：保留原題要求的能力順序（'+structure+'），更換合適情境或比較對象；改題時不可偷偷刪去原題指定的部分。'
    ];
    const tested = [
      '題幹明示要求的能力：'+(mv.length?mv.join('、'):'依各子題提出完整、可檢驗的論述')+'。',
      '推論（非命題委員說明）：可能在辨別考生能否從「'+subjectDomain+'」的理論或證據出發，按題目指定的作答動作完成論證。',
      ...risks(mv)
    ];
    if(q.id==='115-心理學-3') {
      tested.splice(1,0,'概念核對提示：Elkind 的「個人神話」包含個人不可傷害感；應與「假想觀眾」區分。提出兩種理論時，每一種均須對應相應的矯正方法。此為學習解析，非官方標準答案。');
    }
    return {id:q.id,domain:subjectDomain,kind,actions:mv,requirements:req,structure:analysis,tested,reviewStatus:'題幹擷取與命題推論：研究初稿，尚待逐題人工核稿／官方原卷校對'};
  }
  function setList(host,items,ordered) {
    if(!host)return;
    host.replaceChildren();
    items.forEach(item=>{const li=document.createElement('li');li.textContent=item;host.appendChild(li);});
  }
  let lastQuestionId = null;
  function render(q) {
    const second=$('psychTeacherPanel'),third=$('psychIntentPanel'),pointList=$('pointList'),pointTitle=$('pointTitle'),notice=$('psychAnalysisNotice');
    const data=analyze(q);
    const changedQuestion = lastQuestionId !== (q?.id || null);
    lastQuestionId = q?.id || null;
    if(second)second.hidden=!data;
    if(third)third.hidden=!data;
    if(notice)notice.hidden=!data;
    if(!data) return false;
    if(pointTitle)pointTitle.textContent='一、考點拆分';
    setList(pointList,data.requirements);
    setList($('psychTeacherItems'),data.structure);
    setList($('psychIntentItems'),data.tested);
    if(notice)notice.textContent=data.reviewStatus;
    // 教學內容預設不展開；換題時不可保留上一題的展開狀態。
    if(changedQuestion && second)second.open=false;
    if(changedQuestion && third)third.open=false;
    return true;
  }
  root.PsychologyExamAnalysis=Object.freeze({scope,analyze,render});
})(window);
