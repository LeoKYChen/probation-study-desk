// v3.4.2 月度待訂正保護版：網站修正版為準，新來源仍可預覽和同步。
// 測試分支版本：需同時安裝 OfflineBridge.gs；禁止直接替換正式站，請先測試與備份。
// v3.4.1 來源解析補漏收版（以使用者 2026-10-17 上傳之 Markdown.js 為基底）。
// 只更新 daily-simulation/questions.json；保留既有題號與作答資料。
// 2026-10-08：只讀取考試專區，不執行 Markdown 內的 HTML。
function mdPlain_(s) {
  return String(s || "")
    .replace(/\[web:\d+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^>\s?/gm, "")
    .trim();
}
function mdDate_(s) {
  // 西元 2026-10-15 / 20261015 / 2026年10月15日；民國 115-10-15 / 1151015。
  // 僅辨識來源明載日期，絕不以當天日期或檔案修改日補值。
  const text = String(s || "");
  const formats = [
    {
      re: /(?:^|[^\d])(20\d{2})\s*[-_／/.年]\s*(\d{1,2})\s*[-_／/.月]\s*(\d{1,2})(?!\d)/g,
      roc: false,
    },
    { re: /(?:^|[^\d])(20\d{2})(\d{2})(\d{2})(?!\d)/g, roc: false },
    {
      re: /(?:^|[^\d])(1\d{2})\s*[-_／/.年]\s*(\d{1,2})\s*[-_／/.月]\s*(\d{1,2})(?!\d)/g,
      roc: true,
    },
    { re: /(?:^|[^\d])(1\d{2})(\d{2})(\d{2})(?!\d)/g, roc: true },
  ];
  const dates = new Set();
  for (const f of formats) {
    let m;
    while ((m = f.re.exec(text)) !== null) {
      const year = Number(m[1]) + (f.roc ? 1911 : 0),
        month = Number(m[2]),
        day = Number(m[3]);
      const d =
        year +
        "-" +
        String(month).padStart(2, "0") +
        "-" +
        String(day).padStart(2, "0");
      const v = new Date(d + "T00:00:00Z");
      if (!isNaN(v.getTime()) && v.toISOString().slice(0, 10) === d)
        dates.add(d);
    }
  }
  return dates.size === 1 ? Array.from(dates)[0] : "";
}
function mdLabel_(s) {
  return mdPlain_(s)
    .replace(/[【】]/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[：:]$/, "")
    .trim();
}
function mdHeadings_(text) {
  const out = [],
    re = /^\s*(#{1,6})\s+(.+)$/gm;
  let m;
  while ((m = re.exec(text)))
    out.push({
      level: m[1].length,
      label: mdLabel_(m[2]),
      at: m.index,
      end: re.lastIndex,
    });
  return out;
}
function mdSections_(text) {
  const hs = mdHeadings_(text);
  return hs.map((h, i) => {
    let j = i + 1;
    while (j < hs.length && hs[j].level > h.level) j++;
    return {
      label: h.label,
      text: mdPlain_(text.slice(h.end, j < hs.length ? hs[j].at : text.length)),
    };
  });
}
function mdBlocks_(text) {
  const out = [];
  let active = null;
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const h =
      line.match(/^\s*#{1,6}\s+(.+)$/) ||
      line.match(/^\s*\*\*([^*]+)\*\*\s*[：:]?\s*(.*)$/);
    if (h) {
      active = { label: mdLabel_(h[1]), text: h[2] || "" };
      out.push(active);
    } else if (active) active.text += "\n" + line;
  }
  return out;
}
function mdBodyDate_(text) {
  // 僅認文件首頁標題與明確編製日期。新聞子標題即使包含事件日期也不可用。
  const lines=String(text||"").replace(/\r/g,"").split("\n");
  const dates=[];
  const first=lines.findIndex(x=>x.trim());
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    const dateField=/^\s*(?:#{1,6}\s*|[-*]\s*)?(?:\*\*)?(?:編製日期|製作日期|彙整日期|摘要日期|資料日期|產出日期|日期)(?:\*\*)?\s*[：:]/.test(line);
    const docTitle=i===first && (/(?:^#{1,2}\s+|晚間摘要|每日重點|觀護人考試|模擬題)/.test(line));
    if(!dateField&&!docTitle)continue;
    const d=mdDate_(line);
    if(d)dates.push(d);
  }
  const unique=Array.from(new Set(dates));
  return unique.length===1?unique[0]:"";
}
// 僅定位獨立的考試章節；全文標題同時寫「晚間摘要與觀護人考試」不算章節。
function mdExamAnchor_(raw) {
  const label = mdLabel_(String(raw || "")
    .replace(/^\s*[壹貳參肆伍陸柒捌玖拾]+[、.．]\s*/, "")
    .replace(/^\s*(?:第[一二三四五六七八九十]+[章節])[：:、]?\s*/, ""));
  if (/晚間摘要|今日精選|新聞摘要/.test(label)) return false;
  return /^(?:觀護人(?:考試|國考|模擬題|考題)(?:專區|練習)?|司法特考三等觀護人(?:考試|模擬題)?|國考申論題(?:練習|專區)?|觀護人申論模擬題)(?:\s*[｜|：:（(].*)?$/.test(label);
}
function mdExam_(text) {
  text = String(text || "").replace(/\r/g, "");
  const lines = text.split("\n"), hs = mdHeadings_(text);
  const anchor = hs.find(h => mdExamAnchor_(h.label));
  if (anchor) {
    const stop = hs.find(h => h.at > anchor.at && h.level <= anchor.level);
    return text.slice(anchor.at, stop ? stop.at : text.length);
  }
  // Google Docs/Word 匯出可能用純文字、粗體或「貳、」而非 Markdown #。
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const raw = line.replace(/^\*\*(.*?)\*\*\s*$/, "$1");
    if (!mdExamAnchor_(raw)) continue;
    const body=[];
    for(let j=i+1; j<lines.length; j++) {
      // 下一個同級的章節就結束，不擷取後方新聞或附錄。
      if (/^\s*#{1,2}\s+/.test(lines[j])) break;
      if (/^\s*[壹貳參肆伍陸柒捌玖拾]+[、.．]\s*[^\s]/.test(lines[j])) break;
      body.push(lines[j]);
    }
    // 保留標題括號中的當日考科，例如「貳、觀護人考試專區（週四：少年事件處理法）」。
    const title=raw.trim().replace(/^[壹貳參肆伍陸柒捌玖拾]+[、.．]\s*/,"");
    return "# "+title+"\n"+body.join("\n");
  }
  throw Error("未找到獨立考試專區標題");
}
// 只從考試專區中擷取具名欄位，不解析新聞段落。
function mdField_(exam, labels) {
  const re = new RegExp(
    "^\\s*(?:#{2,6}\\s*|\\*\\*)?(?:" +
      labels +
      ")(?:\\*\\*)?\\s*(?:[：:]\\s*(.*))?\\s*$",
  );
  const lines = String(exam).replace(/\r/g, "").split("\n");
  const boundary =
    /^\s*(?:#{1,6}\s+|\*\*[^*]+\*\*\s*[：:]?|(?:輪替科目|題目設計|核心爭點(?:與複習方向)?|答題架構(?:建議)?|複習方向|理論與少年個案應用分析表|考古題出處|改編來源)[：:])/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    const body = [];
    if ((m[1] || "").trim()) body.push(m[1].trim());
    for (let j = i + 1; j < lines.length; j++) {
      if (boundary.test(lines[j])) break;
      body.push(lines[j]);
    }
    return mdPlain_(body.join("\n"));
  }
  return "";
}
// 只排除「不是題目」的明確情況；答案／理論／四欄表缺漏不影響收錄。
function mdIsIndependentQuestion_(question) {
  const q = mdPlain_(question);
  if (q.replace(/\s/g, "").length < 18) return false;
  if (/^(?:題目內容[：:]\s*)?[（(]?詳見(?:上文|前述|新聞|原文)/.test(q)) return false;
  if (/^(?:本題)?(?:無|尚無|待補|略|未提供)(?:題目|考題|資料)/.test(q)) return false;
  if (/^將(?:其|情境|原題)(?:深化|進一步)|^(?:本次|請)改編為|^輪替說明[：:]/.test(q)) return false;
  if (/^(?:依|就|根據)(?:上述|上開|前述|以上)(?:事實|情境|案例|個案)/.test(q)) return false;
  return true;
}
// 摘要型 AI 常先放「將其深化為……」的指令，再放真正的實例題。
// 只有具名題幹標記確實存在時才切割，不憑猜測截斷完整案情。
function mdTrimQuestion_(input) {
  let q = mdPlain_(input).trim();
  const marker = /(?:^|\n)\s*(?:[一二三四五六七八九十0-9]+[、.．]\s*)?(?:【)?(?:改編後實例申論題題目|改編後題目|改編模擬申論題|改編後實例題目)(?:】)?\s*[：:]?\s*(?:\n|$)/g;
  let m, last=null;
  while ((m=marker.exec(q))!==null) last={at:m.index+ m[0].length, index:m.index};
  if (last && (last.index===0 || /將(?:其|情境|原題)(?:深化|進一步)|編輯指令|原題|出處/.test(q.slice(0,last.index))))
    q=q.slice(last.at).trim();
  // 同一章節中的原題與改編題明確分列時，僅擷取改編題。
  const adapted=/(?:^|\n)\s*(?:[-*]\s*)?(?:【)?(?:改編題目|改編後題目)(?:】)?\s*[：:]\s*/g;
  let a,selected=null;
  while((a=adapted.exec(q))!==null) selected={at:a.index+a[0].length,index:a.index};
  if(selected && /(?:^|\n)\s*(?:[-*]\s*)?(?:原題|原試題)[：:]/.test(q.slice(0,selected.index))) q=q.slice(selected.at).trim();
  q=q.replace(/^\s*(?:【改編模擬申論題】|【改編實例申論題】|【改編後題目】)\s*/,'')
     .replace(/^\s*(?:題目設計|改編後題目|題目|試題)\s*[：:]\s*/,"")
     .replace(/^\s*(?:原試題出處|改編來源|考古題出處|題目來源)\s*[：:][^\n]*\n+/,"")
     .trim();
  return q;
}
function mdVersionedId_(base, question, date, subject) {
  const seed =
    String(date || "") +
    "|" +
    String(subject || "") +
    "|" +
    mdQuestionKey_(question);
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    seed,
    Utilities.Charset.UTF_8,
  );
  return (
    base +
    "-q" +
    bytes
      .map((b) => ("0" + ((b + 256) % 256).toString(16)).slice(-2))
      .join("")
      .slice(0, 12)
  );
}

// 從「當日考科」欄位擷取單一值；不能把後續週輪替說明、正文全部當科目。
function mdExplicitSubject_(exam) {
  const lines=String(exam||"").replace(/\r/g,"").split("\n");
  // Some generated Docs put the exam subject and citation metadata on one line.
  // Stop at the next known metadata label rather than passing a whole paragraph
  // into mdCanonicalSubject_(), which intentionally rejects long text.
  const metadata=/(?:\s+|(?=[【（(]))(?:原始?試題出處|原題出處|原試題出處|改編來源|考古題出處|官方試卷來源|【選題資訊】|核心考點|選題理由|歷史比對狀態)\s*[：:]?/;
  const subjectOnly=(value)=>String(value||"").split(metadata,1)[0]
    .replace(/\s*[|｜;；、]\s*$/,"").trim();
  for(let i=0;i<lines.length;i++){
    const x=lines[i].trim().replace(/^#{1,6}\s*/,"")
      .replace(/^\*\*(.*?)\*\*\s*[：:]?\s*/,"$1：");
    const m=x.match(/^(?:當日考科輪替|固定輪替科目|輪替科目|考試科目|當日考科|科目)(?:\s*[：:]\s*(.*))?$/);
    if(!m)continue;
    const inline=subjectOnly(m[1]);
    if(inline)return inline;
    const next=(lines.slice(i+1).find(line=>line.trim())||"").trim();
    if(/^\s*(?:#{1,6}\s*|\*\*|[一二三四五六七八九十]+[、.．])/.test(next))return "";
    return subjectOnly(next);
  }
  return "";
}
function mdCanonicalSubject_(raw) {
  const text = String(raw || "")
    .replace(/[「」『』]/g, "")
    .trim();
  const tokens = [
    "少年事件處理法",
    "保安處分執行法",
    "刑事訴訟法",
    "諮商與輔導",
    "犯罪學",
    "心理學",
    "社會工作",
    "刑法",
    "跨科整合",
  ];
  // 明確排除一整段輪替說明；絕不依星期猜填考科。
  if (
    !text ||
    /輪替說明|固定週|本週其他|其他科目|依例|週一.*週二|請依/.test(text) ||
    text.length > 65
  )
    return "待分類";
  const distinct = tokens.filter((t) => text.includes(t)).sort((a,b)=>text.indexOf(a)-text.indexOf(b));
  if (text === "跨科整合" || /^(?:跨科整合|跨科綜合)/.test(text))
    return "跨科整合";
  if (distinct.length === 0) return "待分類";
  if (distinct.length > 2) return "跨科整合";
  // 單一科目或明確的雙科題，不把其他資訊變成科目字串。
  return distinct.join("與");
}
function mdCaseContext_(exam) {
  const sections = mdSections_(exam);
  const label = /^(?:案例事實|案件事實|個案事實|情境說明|案例情境|案例背景|題目背景|個案情境|情境與考科)$/;
  // 優先完整案情，再考慮混合的「情境與考科」章節。
  const found = sections.find(s => label.test(s.label));
  if (found && found.text.trim()) return found.text
    .split(/^\s*\|/m)[0]
    .replace(/^\s*(?:\*\*)?(?:考科連結|出處|輪替科目)[：:].*$/gm, "").trim();
  // 純文字 Google Docs、粗體標題及「二、案例事實：」皆需支援。
  const lines=String(exam||"").replace(/\r/g,"").split("\n");
  for(let i=0;i<lines.length;i++){
    const raw=lines[i].trim().replace(/^#{1,6}\s*/,"")
      .replace(/^[一二三四五六七八九十0-9]+[、.．]\s*/,"")
      .replace(/^\*\*(.*?)\*\*\s*[：:]?\s*/,"$1：");
    const hit=raw.match(/^(?:案例事實|案件事實|個案事實|案例情境|案例背景|情境說明|題目背景|個案情境)[：:]?\s*(.*)$/);
    if(!hit)continue;
    const body=hit[1]?[hit[1]]:[];
    for(let j=i+1;j<lines.length;j++){
      if(/^\s*#{1,6}\s+/.test(lines[j])||/^\s*[一二三四五六七八九十]+[、.．]\s*[^\s]/.test(lines[j])||
        /^\s*(?:\*\*)?(?:題目設計|改編題目|改編實例申論題|設問|核心爭點|答題架構|參考答案)[：:]?/.test(lines[j]))break;
      if(/^\s*\|/.test(lines[j]))break;
      body.push(lines[j]);
    }
    const text=body.join("\n").trim();
    if(text)return text;
  }
  return "";
}
function mdCompleteQuestion_(question, exam, warnings) {
  let q=mdTrimQuestion_(question);
  // 只有「依上述事實」指向區段外內容時，才補上同一考試專區內的案情。
  const refer=/(?:依|就|根據)(?:上述|上開|前述|以上)(?:事實|情境|案例|個案)/;
  if(refer.test(q)){
    const at=q.search(refer),before=q.slice(0,at);
    const hasFacts=(/案例事實[：:]|案件事實[：:]|個案事實[：:]|情境說明[：:]/.test(before)&&before.replace(/\s/g,"").length>30)|| (before.replace(/\s/g,"").length>60 && /(?:歲|少年|警方|家庭|甲|乙|丙|小凱|涉嫌|施用)/.test(before));
    if(!hasFacts){
      const facts=mdCaseContext_(exam);
      if(facts)q="【案例事實】\n"+facts+"\n\n【設問】\n"+q;
      else throw Error("設問引用上述事實，但來源缺少可獨立擷取的案例事實");
    }
  }
  return q.trim();
}
function mdParseSingle_(text, name, subjectHint) {
  const bodyDate = mdBodyDate_(text),
    nameDate = mdDate_(name),
    date = nameDate || bodyDate,
    warnings = [];
  if (!date) throw Error("文件名稱與文件標題都沒有唯一有效日期");
  if (nameDate && bodyDate && nameDate !== bodyDate)
    throw Error("檔名與編製日期不一致，待人工核對");
  if (!nameDate) warnings.push("日期取自文件標題／編製日期，待核對。");
  if (/答題模板/.test(name))
    return {
      template: {
        subject: "犯罪學",
        date: date,
        content: mdPlain_(text),
        reviewStatus: "待核對",
      },
    };
  const exam = mdExam_(text),
    sections = mdSections_(exam),
    blocks = mdBlocks_(exam);
  const get = (re) => {
    const b = blocks.find((b) => re.test(b.label));
    return b ? mdPlain_(b.text) : "";
  };
  const section = (re) => {
    const b = sections.find((b) => re.test(b.label));
    return b ? b.text : "";
  };
  const qLabel =
    /^(?:今日改編題|改編申論題|考古題改編申論|本週申論題|改編題目?|題目設計|國考模擬題|申論模擬題|模擬申論題|申論題|模擬題目?|案例題|題目|試題)(?:[（(\s：:]|$)/;
  let question =
    section(qLabel) ||
    get(qLabel) ||
    mdField_(exam, "題目設計|改編題目|改編申論題|模擬題|申論題|案例題|題目") ||
    mdGoogleField_(exam, "question");
  // 兼容 AI 將題目寫成「**題目**」或「### 題目設計」的格式。
  question = question
    .split(/^\s*#{1,6}\s+.*(?:爭點|架構|理論|複習)/m)[0]
    .replace(
      /^\s*(?:改編自|改編來源|題目來源|明確來源|原始試題出處)[：:].*$/gm,
      "",
    )
    .trim();
  question = mdCompleteQuestion_(question, exam, warnings);
  if (!mdIsIndependentQuestion_(question))
    throw Error("沒有可獨立作答的完整題幹");
  const combined = section(/^作答爭點與架構/);
  const issues =
    section(/^(?:主要|核心)?爭點|^作答爭點/) ||
    get(/^(?:主要|核心)?爭點|^作答爭點/) ||
    mdField_(exam, "核心爭點與複習方向|核心爭點|主要爭點|作答爭點") ||
    mdGoogleField_(exam, "issues") ||
    combined;
  let outline =
    section(
      /^(?:(?:具體|建議|參考)答題架構|答題架構|複習方向與具體答題架構)/,
    ) ||
    get(/^(?:(?:具體|建議|參考)答題架構|答題架構)/) ||
    mdField_(exam, "答題架構建議|答題架構|參考擬答") ||
    mdGoogleField_(exam, "outline") ||
    combined;
  if (!issues) warnings.push("缺少獨立爭點，已收錄題幹，待補充。");
  if (!outline) warnings.push("缺少答題架構，已收錄題幹，待補充。");
  if (combined) warnings.push("爭點與架構合併於同一節，待人工整理。");
  const tables = [];
  let current = [];
  const flush = () => {
    if (current.length) tables.push(current);
    current = [];
  };
  for (const line of exam.split("\n")) {
    if (/^\s*\|/.test(line)) {
      const row = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split(/(?<!\\)\|/)
        .map((c) => mdPlain_(c.replace(/\\\|/g, "|")));
      if (!row.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, ""))))
        current.push(row);
    } else flush();
  }
  flush();
  const rows =
    tables.find(
      (t) =>
        t.length > 1 &&
        t.every((r) => r.length === 4) &&
        /理論|方法|法律/.test(t[0][0]) &&
        /應用|涵攝/.test(t[0][3]),
    ) || [];
  if (!rows.length) warnings.push("缺少有效四欄表，已收錄題幹，待補充。");
  const subjectLine = mdExplicitSubject_(exam);
  // 只信任獨立的「輪替科目／考試科目」欄位，或考試專區標題括號中的考科。
  // 不搜尋考試專區整篇文字，避免把「本週其他考科輪替說明」讀成一長串科目。
  const titleLine =
    exam
      .split("\n")
      .find((line) =>
        /觀護人.*(?:考試|模擬題)|司法特考三等觀護人/.test(line),
      ) || "";
  const titleSubject =
    (titleLine.match(
      /[（(](?:週[一二三四五六日]|星期[一二三四五六日])[：:]\s*([^）)]+)[）)]/,
    ) || [])[1] || "";
  const candidate = String(
    subjectLine || titleSubject || subjectHint || "",
  ).trim();
  let subject = mdCanonicalSubject_(candidate);
  if (subject === "待分類")
    warnings.push("來源輪替科目未能唯一辨識，已收錄題幹，待分類。");
  const source =
    get(/^(?:題目改編來源|改編來源|題目來源|改編自|明確來源|出處|題源)/) ||
    section(/^考古題核對/) ||
    mdField_(exam, "考古題出處|題目來源|改編來源|原試題出處");
  // 僅保留來源原文；考古題出處不作上線前品質驗收。
  outline = outline.replace(/^\s*\|.*$/gm, "").trim();
  return {
    question: {
      date: date,
      subject: subject.replace("（包括心理測驗）", ""),
      question: mdPlain_(question),
      issues: issues || "",
      outline: outline || "",
      theoryTable: rows,
      sourceReference: source.trim(),
      reviewStatus: "待核對",
      warnings: warnings,
      studyNotes: section(/^複習方向/) || mdField_(exam, "複習方向"),
    },
  };
}
function mdParse_(text, name) {
  if (/答題模板/.test(name)) return mdParseSingle_(text, name);
  const exam = mdExam_(text),
    headings = mdHeadings_(exam);
  const starts = headings
    .map((h) => ({
      h,
      m: h.label.match(
        /^(?:(?:[一二三四五六七八九十\d]+)、)?(?:改編申論|申論模擬題|模擬申論題|第[一二三四五六七八九十\d]+題)[（(]?([一二三四五六七八九十\d]+)?[）)]?/,
      ),
    }))
    .filter((x) => x.m && x.m[1]);
  if (!starts.length) return mdParseSingle_(text, name);
  const hint = (exam
    .slice(0, 900)
    .match(
      /刑事訴訟法|保安處分執行法|少年事件處理法|諮商與輔導|犯罪學|心理學|刑法|跨科整合/,
    ) || [])[0];
  const questions = [];
  for (const item of starts) {
    const h = item.h,
      next = headings.find((x) => x.at > h.at && x.level <= h.level);
    const chunk = exam.slice(h.end, next ? next.at : exam.length);
    const hasQuestionHeader = mdHeadings_(chunk).some((x) =>
      /^(?:題目設計|改編題目?|題目|申論題)/.test(x.label),
    );
    const p = mdParseSingle_(
      "# 觀護人考試專區｜" +
        (hint || "") +
        "\n" +
        (hasQuestionHeader ? "" : "### 題目設計\n") +
        chunk,
      name,
      hint,
    );
    p.question.partKey = item.m[1];
    questions.push(p.question);
  }
  return { questions: questions };
}
function mdAssertPreserved_(oldQuestions, newQuestions) {
  const ids = new Set(newQuestions.map((q) => q.id)),
    texts = new Set(
      newQuestions.map((q) => q.question.replace(/[\s\u3000]/g, "")),
    );
  for (const q of oldQuestions)
    if (!ids.has(q.id) && !texts.has(q.question.replace(/[\s\u3000]/g, "")))
      throw Error("同步保留檢查失敗：既有題目遺失，停止寫入 GitHub");
}
// 只更新 daily-simulation/questions.json，保留正式站。
function mdOrigin_(fileId) {
  return (
    "md-" +
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      fileId,
      Utilities.Charset.UTF_8,
    )
      .map((b) => ("0" + ((b + 256) % 256).toString(16)).slice(-2))
      .join("")
      .slice(0, 20)
  );
}
// 2026-10-19 修正：GitHub Contents API 的檔案超過 1 MiB 時，回傳可能省略內嵌內容。
// 仍以 Contents API 取得目前分支 SHA；必要時再透過 Git Blob API 讀回內容。
function mdGithub_(path, method, body) {
  const p = PropertiesService.getScriptProperties(),
    repo = p.getProperty('GITHUB_REPO'),
    branch = p.getProperty('GITHUB_BRANCH'),
    token = p.getProperty('GITHUB_TOKEN');
  if (repo !== 'LeoKYChen/probation-study-desk' || branch !== 'main' || !token)
    throw Error('請確認 GitHub 指令碼屬性；本模組只允許正式 main 分支');
  const baseUrl = 'https://api.github.com/repos/' + repo + '/';
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  function request_(url, verb, payload) {
    const opts = { method: verb, headers: headers,
      muteHttpExceptions: true, followRedirects: false };
    if (payload) {
      opts.contentType = 'application/json';
      opts.payload = JSON.stringify(payload);
    }
    const response = UrlFetchApp.fetch(url, opts), status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      if (verb === 'get' && status === 404) return null;
      const hint = status === 401 ? 'Token 無效' :
        status === 403 ? '權限、分支保護或 API 配額' :
        status === 409 || status === 422 ? '分支或檔案 SHA 衝突' : '請檢查 GitHub';
      throw Error('GitHub HTTP ' + status + '（' + hint + '）');
    }
    try { return JSON.parse(response.getContentText()); }
    catch (e) { throw Error('GitHub 回應不是有效 JSON，請確認服務狀態'); }
  }
  const endpoint = baseUrl + 'contents/' +
    path.split('/').map(encodeURIComponent).join('/') +
    (method === 'get' ? '?ref=' + encodeURIComponent(branch) : '');
  const meta = request_(endpoint, method, body);
  if (method !== 'get' || !meta) return meta;
  if (meta.type !== 'file' || !meta.sha) throw Error('GitHub 路徑不是正常檔案：' + path);
  if (meta.content && meta.encoding === 'base64') return meta;
  // 只有真正的 GitHub blob SHA 可用於回讀，不接受外部網址。
  if (!/^[a-f0-9]{40}$/i.test(meta.sha)) throw Error('GitHub 檔案 SHA 格式異常');
  const blob = request_(baseUrl + 'git/blobs/' + meta.sha, 'get');
  if (!blob || !blob.content || blob.encoding !== 'base64' || blob.sha !== meta.sha)
    throw Error('無法以 Git Blob API 讀取大型題庫，停止同步，原有題庫未覆寫');
  return { sha: meta.sha, content: blob.content, encoding: 'base64', type: meta.type };
}
function mdDecode_(r) {
  if (!r || r.encoding !== 'base64' || !r.content || !String(r.content).trim())
    throw Error('GitHub 題庫缺少 Base64 原文；請先檢查讀取權限，停止解析');
  let raw;
  try {
    raw = Utilities.newBlob(
      Utilities.base64Decode(String(r.content).replace(/\s/g, ''))
    ).getDataAsString('UTF-8');
  } catch (e) { throw Error('GitHub 題庫 Base64 解碼失敗：' + String(e.message || e)); }
  if (!raw.trim()) throw Error('GitHub 題庫內容為空，停止解析');
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw Error('GitHub 題庫 JSON 格式錯誤：' + String(e.message || e)); }
  if (!data || !Array.isArray(data.questions))
    throw Error('GitHub 題庫缺少 questions 陣列，停止同步');
  return data;
}

// 只有 Google 文件前段的日期欄位或明確標題可以作日期來源；不掃描新聞內容。
function mdGoogleDocDate_(parts) {
  const found = new Set();
  for (const part of parts) {
    const lines = String(part.text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    lines.forEach((line, i) => {
      const header =
        /^(?:#{1,2}\s*)?(?:日期|編製日期|製作日期|彙整日期|摘要日期|資料日期|題目日期|產出日期)\s*[：:]/.test(
          line,
        );
      const title =
        i === 0 && /(?:晚間|觀護人|每日|模擬題|申論題|學習)/.test(line);
      if (header || title) {
        const d = mdDate_(line);
        if (d) found.add(d);
      }
    });
  }
  return found.size === 1 ? Array.from(found)[0] : "";
}

// 新來源用「檔案 ID + 文件中第幾道有效題」建立穩定識別碼，避免同一天不同文件的 ID 重複。
// 只在題幹與原有 date-N 完全相同時沿用舊 ID；不把不同題目的新內容覆寫到舊 ID。
function mdGoogleId_(fileId, index) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(fileId),
    Utilities.Charset.UTF_8,
  );
  const hash = bytes
    .map((b) => ("0" + ((b + 256) % 256).toString(16)).slice(-2))
    .join("")
    .slice(0, 24);
  return "gd-" + hash + "-" + index;
}
function mdQuestionKey_(s) {
  return String(s || "").replace(/[\s\u3000]/g, "");
}

// Google 文件多為純文字標題；即使沒有完整「下一節」也要保留可獨立作答的題幹。
function mdGoogleField_(text, kind) {
  const choices = {
    question: [
      "題目設計",
      // 純文字 Word/Google Docs 常用「三、改編後實例申論題題目」而非 Markdown 標題。
      "改編後實例申論題題目",
      "改編後實例申論題",
      "改編模擬申論題題目",
      "改編後申論題",
      "改編實例申論題",
      "實例申論題",
      "改編申論題",
      "改編後題目",
      "改編題目",
      "模擬題目",
      "申論題",
      "案例題",
      "題目",
    ],
    issues: [
      "核心爭點剖析",
      "核心爭點與複習方向",
      "爭點剖析與複習方向",
      "核心爭點",
      "主要爭點",
      "爭點與複習方向",
      "爭點",
    ],
    outline: [
      "答題架構與擬答分析",
      "完整答題架構建議",
      "完整申論答題架構",
      "答題架構建議",
      "建議答題架構",
      "答題架構",
      "參考擬答",
    ],
    theory: [
      "四欄標準理論與少年個案應用分析表",
      "理論與方法四欄標準分析表",
      "核心理論四欄標準分析表",
      "理論與少年個案應用分析表",
      "理論與個案應用分析表",
      "理論應用表",
    ],
    subject: ["當日考科輪替", "固定輪替科目", "輪替科目", "考試科目", "當日考科"],
  };
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n");
  const all = [].concat(...Object.values(choices));
  const clean = (line) =>
    String(line)
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/^\s*[一二三四五六七八九十0-9]+[、.．]\s*/, "")
      .replace(/^\s*\*\*|\*\*\s*$/g, "")
      .trim();
  const marker = (line) => {
    const t = clean(line);
    for (const label of all) {
      if (
        t === label ||
        t.startsWith(label + "：") ||
        t.startsWith(label + ":") ||
        t.startsWith(label + "（") ||
        t.startsWith(label + "(")
      )
        return {
          label,
          after: /^[：:]/.test(t.slice(label.length))
            ? t.slice(label.length).replace(/^[：:]\s*/, "")
            : "",
        };
    }
    return null;
  };
  for (let i = 0; i < lines.length; i++) {
    const m = marker(lines[i]);
    if (!m || !choices[kind].includes(m.label)) continue;
    const body = m.after ? [m.after] : [];
    for (let j = i + 1; j < lines.length; j++) {
      if (marker(lines[j])) break;
      if (kind === "question" && /^\s*[一二三四五六七八九十]+[、.．]\s*(?:考古題|來源|解析|答題|評析|說明|核對|複習|理論|案例處遇|評分|參考|結論)/.test(lines[j])) break;
      body.push(lines[j]);
    }
    return mdPlain_(body.join("\n"));
  }
  return "";
}
// 單一來源失敗時略過並留下診斷，不影響其餘來源；但 ID 真正碰撞時仍阻止同步。
function mdReadGoogleBank_(previous, diagnostics, filter) {
  diagnostics = diagnostics || [];
  const folder =
    PropertiesService.getScriptProperties().getProperty("SOURCE_FOLDER_ID");
  if (!folder) throw Error("缺少 SOURCE_FOLDER_ID");
  const files = DriveApp.getFolderById(folder).getFilesByType(
    MimeType.GOOGLE_DOCS,
  );
  const questions = [],
    ids = new Set(),
    oldQuestions = previous.questions || [];
  const oldById = new Map(oldQuestions.map((q) => [q.id, q]));
  const oldByText = new Map(),
    claimedLegacy = new Set();
  for (const old of oldQuestions) {
    const key = old.date + "|" + mdQuestionKey_(old.question);
    if (!oldByText.has(key)) oldByText.set(key, []);
    oldByText.get(key).push(old.id);
  }
  let latest = Date.parse(previous.updatedAt) || 0,
    processed = 0,
    accepted = 0,
    skipped = 0;
  while (files.hasNext()) {
    const file = files.next();
    if (filter && filter.googleIds && !filter.googleIds.has(file.getId())) continue;
    processed++;
    try {
      const parts = readDailyTabs_(
        DocumentApp.openById(file.getId()).getTabs(),
      );
      const nameDate = mdDate_(file.getName()),
        bodyDate = mdGoogleDocDate_(parts);
      if (nameDate && bodyDate && nameDate !== bodyDate)
        throw Error("檔名日期與文件標題日期不一致，待核對");
      const date = nameDate || bodyDate;
      if (!date) throw Error("檔名與文件標題缺少唯一有效日期");
      const pending = [],
        pendingLegacy = [];
      for (const part of parts) {
        const text = String(part.text || "").replace(/\r/g, "");
        // 僅從考試專區內取科目，排除新聞的「本週輪替」說明。
        let examText;
        try { examText = mdExam_(text); }
        catch (e) {
          // 部分早期 Google 文件沒有專區標題，但有明確「題目設計」。
          // 僅當出現獨立題目標記時，才允許退回該段以後的內容。
          const lines=text.split("\n");
          const start=lines.findIndex(line => /^\s*(?:#{1,6}\s*|[一二三四五六七八九十]+[、.．]\s*|\*\*)?(?:題目設計|改編實例申論題|改編申論題|實例申論題)(?:\*\*)?\s*[：:]?/.test(line));
          if(start<0)continue;
          examText="# 觀護人考試專區\n"+lines.slice(start).join("\n");
        }
        const rawSubject = mdExplicitSubject_(examText);
        const titleMatch=examText.match(/觀護人考試專區[^\n]{0,100}[（(]週[一二三四五六日][：:]\s*([^）)]+)/);
        let subject=mdCanonicalSubject_(rawSubject || (titleMatch?titleMatch[1]:""));
        let question = mdGoogleField_(examText, "question") ||
          dailySection_(examText, "題目設計", "核心爭點與複習方向");
        if (question) {
          try { question = mdCompleteQuestion_(question,examText,[]); }
          catch (e) { diagnostics.push("Google 文件【"+file.getName().slice(0,80)+"】："+e.message+"；來源該題略過。");continue; }
        }
        const issues =
          dailySection_(examText, "核心爭點與複習方向", "答題架構建議") ||
          mdGoogleField_(examText, "issues");
        const outline =
          dailySection_(examText, "答題架構建議", "理論與少年個案應用分析表") ||
          mdGoogleField_(examText, "outline");
        if (!mdIsIndependentQuestion_(question)) continue;
        const missingSubject = subject === "待分類";
        const table =
          (part.tables || []).find(
            (rows) =>
              rows.length > 1 &&
              rows.every((row) => row.length === 4) &&
              /理論|方法|法律/.test(rows[0][0]) &&
              /應用|涵攝/.test(rows[0][3]),
          ) || [];
        const key = date + "|" + mdQuestionKey_(question);
        const candidates = oldByText.get(key) || [];
        // 先確定「來源文件自己」的穩定 ID。不同 Google 文件即使題幹相同，
        // 也不得互相認領對方的 gd- ID：否則依 Drive 列舉順序可能重複使用同一題號。
        const sourceId = mdGoogleId_(file.getId(), pending.length + 1);
        const sourcePrefix = sourceId.slice(0, sourceId.lastIndexOf("-") + 1);
        const availableOldId = (candidate) =>
          !claimedLegacy.has(candidate) &&
          !pendingLegacy.includes(candidate) &&
          !ids.has(candidate) &&
          !pending.some((q) => q.id === candidate);
        // 優先沿用同一文件的既有 gd- 題號（含 -q 改版題號），
        // 再兼容舊版非來源綁定題號；明確排除其他文件的 gd-/md- 題號。
        const oldId =
          candidates.find((candidate) => candidate === sourceId && availableOldId(candidate)) ||
          candidates.find((candidate) => candidate.startsWith(sourcePrefix) && availableOldId(candidate)) ||
          candidates.find((candidate) => !/^(?:gd-|md-)/.test(candidate) && availableOldId(candidate));
        let id = oldId || sourceId;
        const prior = oldById.get(id);
        // 人工訂正的題目由 GitHub 正式版本管理；勿因來源 Drive 尚未修改，重產 -q 改版重複題。
        if (prior && prior.qualityStatus === '待訂正') {
          const existing = pending.find((q) => q.id === id) ||
            questions.find((q) => q.id === id);
          if (existing) {
            // 同一既有題號、同一日期與題幹：只讀取一次，不解除人工訂正保護。
            if (existing.date === prior.date &&
                mdQuestionKey_(existing.question) === mdQuestionKey_(prior.question)) {
              diagnostics.push('Google 文件【' + file.getName().slice(0,80) +
                '】：同一人工訂正題號重複來源，略過：' + id);
              continue;
            }
            throw Error('題目 ID 衝突：' + id + '；不同題目不得共用已訂正 ID，停止同步');
          }
          pending.push(Object.assign({}, prior));
          if (oldId) pendingLegacy.push(oldId);
          diagnostics.push('Google 文件既有月度訂正版保留：' + id);
          continue;
        }
        if (
          prior &&
          mdQuestionKey_(prior.question) === mdQuestionKey_(question) &&
          prior.date === date
        )
          subject = prior.subject;
        if (
          prior &&
          (mdQuestionKey_(prior.question) !== mdQuestionKey_(question) ||
            prior.date !== date ||
            prior.subject !== subject)
        )
          id = mdVersionedId_(id, question, date, subject);
        const existing = pending.find((q) => q.id === id) ||
          questions.find((q) => q.id === id);
        if (existing) {
          if (existing.date === date &&
              mdQuestionKey_(existing.question) === mdQuestionKey_(question)) {
            diagnostics.push('Google 文件【' + file.getName().slice(0,80) +
              '】：相同 ID、相同日期與題幹，已保留第一筆：' + id);
            continue;
          }
          // 不同題幹／日期共用 ID 為真正碰撞，不允許以新資料覆蓋舊題。
          throw Error('題目 ID 衝突：' + id + '；不同題幹或日期，停止同步');
        }
        const start = text.indexOf("輪替科目"),
          end = text.indexOf(question, start);
        const ref = (
          start >= 0
            ? text.slice(
                start,
                end > start ? end : Math.min(text.length, start + 1000),
              )
            : text.slice(0, 1000)
        ).match(
          /(?:^|\n)\s*(?:【|\*\*)?(?:原試題出處|原始試題出處|原題出處|改編來源|出處)(?:】|\*\*)?\s*[：:]\s*([^\n]+)/,
        );
        const old = oldById.get(id),
          warnings = [];
        if (missingSubject) warnings.push("來源未提供輪替科目，待分類。");
        if (!issues) warnings.push("缺少獨立爭點，待補充。");
        if (!outline) warnings.push("缺少答題架構，待補充。");
        if (!table.length) warnings.push("缺少有效四欄表，待補充。");
        const q = {
          id,
          date,
          subject,
          question: (prior && mdQuestionKey_(prior.question)===mdQuestionKey_(question) && prior.date===date)
            ? prior.question : mdPlain_(question),
          issues: issues || "",
          outline: outline || "",
          theoryTable: table,
          sourceReference: ref
            ? ref[1].trim()
            : old
              ? old.sourceReference || ""
              : "",
          reviewStatus: "待核對",
          warnings,
        };
        pending.push(q);
        if (oldId) pendingLegacy.push(oldId);
        if (warnings.length)
          diagnostics.push(
            "Google 文件【" + file.getName().slice(0,80) + "】：" + warnings.join(" "),
          );
      }
      if (!pending.length) throw Error(date + " 沒有可獨立作答的完整題幹");
      pendingLegacy.forEach((id) => claimedLegacy.add(id));
      pending.forEach((q) => {
        ids.add(q.id);
        questions.push(q);
      });
      accepted++;
      latest = Math.max(latest, file.getLastUpdated().getTime());
    } catch (e) {
      if (filter && filter.strict) throw new Error('所選 Google 題目來源解析失敗：'+String(e.message || e));
      if (/^題目 ID 衝突/.test(String(e.message || e))) throw e;
      skipped++;
      const reason = String(e.message || e).slice(0, 180);
      diagnostics.push(
        "Google 文件【" + file.getName().slice(0,80) + "】：" + reason + "；本次略過，舊題保留。",
      );
      console.log(
        "Google 文件 #" +
          processed +
          "【" +
          file.getName().slice(0, 80) +
          "】未採用：" +
          reason,
      );
    }
  }
  console.log(
    "Google 題庫來源：共 " +
      processed +
      " 份；採用 " +
      accepted +
      " 份，略過 " +
      skipped +
      " 份。",
  );
  if (!questions.length)
    diagnostics.push(
      "本次沒有新增可解析的 Google 文件題幹；繼續保留正式舊題。",
    );
  return {
    schemaVersion: 1,
    updatedAt: new Date(latest || Date.now()).toISOString(),
    count: questions.length,
    questions,
  };
}
function mdCollect_(filter) {
  const props = PropertiesService.getScriptProperties(),
    folderId = props.getProperty("MD_SOURCE_FOLDER_ID");
  if (!folderId) throw Error("請設定 MD_SOURCE_FOLDER_ID");
  // After safe monthly activation use verified shard contents supplied by the manual
  // synchronizer. Do not re-read the frozen legacy questions.json snapshot.
  const previous = filter && filter.previousDataset ? null :
    mdGithub_("daily-simulation/questions.json", "get");
  if (!previous && !(filter && filter.previousDataset))
    throw Error("正式題庫未找到；停止測試同步");
  const old = filter && filter.previousDataset ? filter.previousDataset : mdDecode_(previous),
    diagnostics = [];
  const base = mdReadGoogleBank_(old, diagnostics, filter);
  if (base.schemaVersion !== 1 || !Array.isArray(base.questions))
    throw Error("來源題庫格式異常");
  const questions = base.questions.slice(),
    templates = [];
  const files = DriveApp.getFolderById(folderId).getFiles();
  let supported = 0,
    latest = Math.max(
      Date.parse(base.updatedAt) || 0,
      Date.parse(old.updatedAt) || 0,
    );
  while (files.hasNext()) {
    const f = files.next();
    if (!/\.md$/i.test(f.getName())) continue;
    if (filter && filter.mdIds && !filter.mdIds.has(f.getId())) continue;
    supported++;
    const origin = mdOrigin_(f.getId());
    try {
      if (f.getSize() > 1024 * 1024) throw Error("MD 超過 1 MB");
      const parsed = mdParse_(
        f.getBlob().getDataAsString("UTF-8"),
        f.getName(),
      );
      if (parsed.template) {
        parsed.template.id = origin;
        templates.push(parsed.template);
      } else if (parsed.questions) {
        for (const q of parsed.questions) {
          q.id = origin + "-" + q.partKey;
          delete q.partKey;
          questions.push(q);
        }
      } else {
        parsed.question.id = origin;
        questions.push(parsed.question);
      }
      const parsedQuestions =
        parsed.questions || (parsed.question ? [parsed.question] : []);
      for (const q of parsedQuestions)
        for (const w of q.warnings || [])
          if (!/^原始考題出處/.test(w)) {
            diagnostics.push(f.getName() + "：" + w);
            console.log("待核對【" + f.getName() + "】：" + w);
          }
      latest = Math.max(latest, f.getLastUpdated().getTime());
      console.log("文件 " + supported + "【" + f.getName() + "】：解析完成");
    } catch (e) {
      if (filter && filter.strict) throw new Error('所選 Markdown 題目來源解析失敗：'+String(e.message || e));
      const retained = (old.questions || []).filter(
          (q) => q.id === origin || q.id.startsWith(origin + "-"),
        ),
        retainedTemplate = (old.templates || []).find((t) => t.id === origin);
      if (retained.length) questions.push.apply(questions, retained);
      if (retainedTemplate) templates.push(retainedTemplate);
      const message =
        "MD 文件【" +
        f.getName() +
        "】解析失敗（" +
        e.message +
        "），" +
        (retained.length || retainedTemplate
          ? "已保留上一份可用內容"
          : "本次略過") +
        "。";
      diagnostics.push(message);
      console.log(message + " 原因：" + e.message);
    }
  }
  if (!supported) diagnostics.push("本次沒有 MD 來源；保留既有題庫。");
  // 保護不可變識別：舊題 ID 永遠指向原題幹、日期及科目。
  // 特別處理來源先改版、前次已建立 -q 版號，這次又掃到同一版號的情況。
  // 若同一題幹只有換行、空格或科目標記變動，沿用舊資料，不觸發題號重命名。
  const oldById = new Map((old.questions || []).map((q) => [q.id, q]));
  const reservedIds = new Set(oldById.keys());
  function sameIdentity_(a,b) {
    return !!a && a.date === b.date &&
      mdQuestionKey_(a.question) === mdQuestionKey_(b.question);
  }
  for (const q of questions) {
    const prior = oldById.get(q.id);
    if (!prior) continue;
    // 待訂正項目以網頁已發布的人工修正版為準，避免下次同步倒退為錯誤文字。
    // 含日期、題幹、科目、四欄表與複核旗標均保持不變；每月人工驗收後才改狀態。
    if (prior.qualityStatus === '待訂正') {
      Object.keys(q).forEach(key => delete q[key]);
      Object.assign(q, prior);
      diagnostics.push('保留月度待訂正版本：' + q.id);
      continue;
    }
    if (sameIdentity_(prior,q)) {
      q.question = prior.question; // 既有作答一律沿用舊題幹原文
      q.date = prior.date;
      q.subject = prior.subject;
      continue;
    }
    // 題幹或日期確實改版：新版本另建 ID，不覆寫既有題目。
    const original = q.id;
    const baseVersion = mdVersionedId_(original, q.question, q.date, q.subject);
    let candidate = baseVersion, n = 1;
    while (reservedIds.has(candidate) && !sameIdentity_(oldById.get(candidate),q)) {
      if (++n > 20) throw Error('新題識別碼無法避開舊題號，停止同步');
      candidate = mdVersionedId_(original+'-v'+n,q.question,q.date,q.subject);
    }
    q.id = candidate;
    const existingVersion = oldById.get(candidate);
    if (existingVersion && sameIdentity_(existingVersion,q)) {
      q.question = existingVersion.question;
      q.date = existingVersion.date;
      q.subject = existingVersion.subject;
      diagnostics.push('沿用既有改版題號：'+candidate+'。');
    } else {
      diagnostics.push('來源題目改版：舊題號 '+original+' 保留，新題另建 '+candidate+'。');
    }
  }
  const freshIds = new Set(questions.map((q) => q.id));
  for (const q of old.questions || []) {
    if (!freshIds.has(q.id)) {
      questions.push(q);
      freshIds.add(q.id);
      diagnostics.push(
        "已保留既有題目：" +
          q.date +
          " " +
          q.subject +
          "；本次未產生相同識別碼，未自動刪除。",
      );
    }
  }
  const templateIds = new Set(templates.map((t) => t.id));
  for (const t of old.templates || [])
    if (!templateIds.has(t.id)) templates.push(t);
  // 同一題重複出現在不同來源時，優先沿用正式站已有的題目 ID，以免作答紀錄失聯。
  const oldIds = new Set((old.questions || []).map((q) => q.id)),
    byText = new Map(),
    dedup = [];
  for (const q of questions) {
    const key = q.date + "|" + mdQuestionKey_(q.question),
      position = byText.get(key);
    if (position === undefined) {
      byText.set(key, dedup.length);
      dedup.push(q);
      continue;
    }
    const prior = dedup[position];
    if (oldIds.has(q.id) && oldIds.has(prior.id) && q.id !== prior.id) {
      dedup.push(q); // 兩筆既有 ID 均可能有作答，絕不自動刪掉其一。
      diagnostics.push("同日題幹相同但均為既有題號，兩筆均保留以免作答失聯。");
    } else {
      if ((oldIds.has(q.id) && !oldIds.has(prior.id)) ||
          (!oldIds.has(q.id) && !oldIds.has(prior.id) && q.id.localeCompare(prior.id)<0)) dedup[position] = q;
      diagnostics.push("已略過一筆完全相同的來源題目；優先保留既有題目 ID。");
    }
  }
  // 資料夾列舉順序並不固定：同一天依穩定 ID 排序，避免無新題卻每日重送 GitHub。
  dedup.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  // 禁止不同題目共用同一 ID；不因重複來源而遺失既有題目。
  const uniqueIds = new Set();
  for (const q of dedup) {
    if (uniqueIds.has(q.id))
      throw Error("同一題目 ID 對應多題：" + q.id + "；停止同步");
    uniqueIds.add(q.id);
  }
  mdAssertPreserved_(old.questions || [], dedup);
  const finalById = new Map(dedup.map(q=>[q.id,q]));
  for (const previousQuestion of old.questions || []) {
    const q=finalById.get(previousQuestion.id);
    if (!q) throw Error("既有題目 ID 遺失："+previousQuestion.id+"；停止同步");
    if (q.question!==previousQuestion.question || q.date!==previousQuestion.date || q.subject!==previousQuestion.subject)
      throw Error("既有題目 ID 對應資料改變："+previousQuestion.id+"；停止同步");
  }
  // 診斷與模板固定排序，避免僅因 Drive 列舉順序不同就重複更新。
  diagnostics.sort((a,b)=>a.localeCompare(b,"zh-Hant"));
  templates.sort((a,b)=>a.id.localeCompare(b.id));
  const data = {
    schemaVersion: 1,
    updatedAt: new Date(latest).toISOString(),
    count: dedup.length,
    questions: dedup,
    templates: templates,
    diagnostics: diagnostics,
  };
  // 不輸出來源文件網址、ID、新聞全文或權杖。
  if (
    /(?:docs|drive)\.google\.com|(?:ghp_|github_pat_|sk-proj-)/i.test(
      JSON.stringify(data),
    )
  )
    throw Error("內容含不應公開的網址或權杖樣式，停止發布");
  return { data: data, previous: previous };
}
function previewDailyResources() {
  const result = mdCollect_(),
    before = mdDecode_(result.previous),
    oldIds = new Set((before.questions || []).map((q) => q.id));
  const added = result.data.questions.filter((q) => !oldIds.has(q.id));
  const incomplete = added.filter(
    (q) => !String(q.issues||"").trim() || !String(q.outline||"").trim() || !Array.isArray(q.theoryTable) || q.theoryTable.length < 2,
  );
  console.log("=== 每日模擬題預覽：僅讀取，不發布 ===");
  console.log(
    "正式站舊題：" +
      before.questions.length +
      "；預計題庫：" +
      result.data.count +
      "；新增 ID：" +
      added.length,
  );
  console.log(
    "新增待補充：" +
      incomplete.length +
      "；來源診斷：" +
      result.data.diagnostics.length +
      "；答題模板：" +
      result.data.templates.length,
  );
  console.log(
    "新增題目：" +
      (added.map((q) => q.date + " " + q.subject + " " + q.id).join("、") ||
        "無"),
  );
  // 題號不足以核對；預覽完整列出每道新題的題幹前 180 字與待補項目。
  for (let i = 0; i < added.length; i++) {
    const q = added[i];
    const excerpt = String(q.question || "")
      .replace(/\s+/g, " ")
      .slice(0, 180);
    const flags = [
      !String(q.issues||"").trim() ? "缺爭點" : "",
      !String(q.outline||"").trim() ? "缺架構" : "",
      !Array.isArray(q.theoryTable)||q.theoryTable.length < 2 ? "缺四欄表" : "",
      q.subject === "待分類" ? "待分類" : "",
    ].filter(Boolean);
    console.log(
      "新增題目核對 #" +
        (i + 1) +
        "：" +
        q.id +
        "｜" +
        q.date +
        "｜" +
        q.subject +
        "｜" +
        (flags.join("、") || "結構完整") +
        "｜" +
        excerpt,
    );
  }
  console.log(
    "最新收錄日期：" +
      result.data.questions.reduce((v, q) => (q.date > v ? q.date : v), ""),
  );
  console.log("須保護的舊題 ID 已由 mdCollect_ 驗證；此函式不會寫入 GitHub。");
  console.log(
    "說明：本次只檢查格式與既有 ID 保護；法律正確性由使用者於一鍵 AI 批改時另行檢視。",
  );
}
function syncDailyResources() {
  if (String(PropertiesService.getScriptProperties().getProperty('PSD_ALLOW_LEGACY_FULL_SYNC')).toLowerCase()!=='true')
    throw Error('舊版全量同步已停用，請使用 manualSyncDailyQuestions；不要直接重新執行 syncDailyResources。');
  if (typeof psdSyncGeneratedBridge_ !== 'function')
    throw Error('尚未安裝 OfflineBridge.gs，未寫入題庫。');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw Error("已有同步執行中");
  try {
    const result = mdCollect_(),
      content = JSON.stringify(result.data, null, 2) + "\n";
    console.log(
      "同步核對：題數=" +
        result.data.count +
        "；最新題目日期=" +
        result.data.questions.reduce((v, q) => (q.date > v ? q.date : v), "") +
        "；診斷數=" +
        result.data.diagnostics.length,
    );
    if (result.previous) {
      const oldContent = Utilities.newBlob(
        Utilities.base64Decode(String(result.previous.content).replace(/\s/g, '')),
      ).getDataAsString("UTF-8");
      if (oldContent === content) {
        // 先前 JSON 可能成功、離線資料產生失敗，故無異動仍執行修復核對。
        psdSyncGeneratedBridge_('daily');
        console.log("題目 JSON 相同；已核對離線 ZIP 資料檔。");
        return;
      }
    }
    const payload = {
      message: "Update daily resources with flexible Markdown parser",
      branch:
        PropertiesService.getScriptProperties().getProperty("GITHUB_BRANCH"),
      content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    };
    if (result.previous) payload.sha = result.previous.sha;
    // 正式題庫、離線資料檔先後寫入；任一步失敗都可重跑，不更動舊題 ID。
    mdGithub_("daily-simulation/questions.json", "put", payload);
    const verified = mdGithub_("daily-simulation/questions.json", "get");
    const verifiedData = mdDecode_(verified);
    if (JSON.stringify(verifiedData) !== JSON.stringify(result.data))
      throw Error('題庫已寫入但讀回核對不符；請先預覽，避免重複盲目執行');
    psdSyncGeneratedBridge_('daily');
    console.log(
      "GitHub 題庫已核對：" + result.data.count + " 題、" +
      result.data.templates.length + " 份模板；離線資料檔已核對。網站仍待發布工作流程完成。",
    );
  } finally {
    lock.releaseLock();
  }
}