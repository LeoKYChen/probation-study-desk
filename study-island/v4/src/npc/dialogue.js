// 原創居民與對話。對話只做學習鼓勵與遊戲引導，不含需查證的法律或學理內容。
// 物種沿用 v3：栗子＝狐狸、阿棕＝熊、小白＝兔子、墨墨＝貓頭鷹。名稱與台詞依外觀主題（theme.js）切換。
import { theme, npcName } from '../theme.js';
export const NPCS = [
  {
    id: 'chestnut', name: '栗子', species: 'fox', subject: '少年事件處理法',
    home: { x: 12, y: 9 }, range: 2,
    colors: { body: '#d9844a', belly: '#fbe6cc', ear: '#8a4a2b', scarf: '#5c9a8a' },
    robe: { robe: '#e8a87c', trim: '#b8664a', hair: '#3b2a24', style: 'bun' },
    hint: ctx => ctx.shellsToday === 0
      ? '南邊的沙灘上有 ' + ctx.shellsTotal + ' 個貝殼在閃閃發光，去看看吧？'
      : ctx.shellsToday < ctx.shellsTotal
        ? '你已經找到 ' + ctx.shellsToday + ' 個貝殼了，還剩 ' + (ctx.shellsTotal - ctx.shellsToday) + ' 個藏在沙灘。'
        : '今天的貝殼都被你找到了！明天海浪會再帶來新的。',
    rest: '讀書累了就來島上走走，休息也是進步的一部分喔。'
  },
  {
    id: 'brownie', name: '阿棕', species: 'bear', subject: '犯罪學',
    home: { x: 3, y: 6 }, range: 2,
    colors: { body: '#a87b58', belly: '#e9d2b6', ear: '#7d5940', scarf: '#d4a24c' },
    robe: { robe: '#7a9e7e', trim: '#4f7356', hair: '#2b2622', style: 'topknot' },
    hint: () => '樹林裡常有掉下來的樹枝，撿回去就是木材，可以拿來做家具。',
    rest: '一次搞懂一件事就好，慢慢來比較穩。'
  },
  {
    id: 'snowy', name: '小白', species: 'bunny', subject: '心理學',
    home: { x: 5, y: 11 }, range: 2,
    colors: { body: '#f6f3ee', belly: '#ffffff', ear: '#f2b8c0', scarf: '#8fb6e0' },
    robe: { robe: '#f4f1ea', trim: '#8fb6e0', hair: '#4a3530', style: 'twin' },
    hint: () => '我最喜歡花了！多撿幾片葉子，就能在工坊做花圃。',
    rest: '今天有好好吃飯、好好睡覺嗎？照顧自己也很重要。'
  },
  {
    id: 'inky', name: '墨墨', species: 'owl', subject: '諮商／訂正',
    home: { x: 12, y: 6 }, range: 1,
    colors: { body: '#6f6a8f', belly: '#d8d2ea', ear: '#4f4a6e', scarf: '#e0b65a' },
    robe: { robe: '#6f6a8f', trim: '#e0b65a', hair: '#d9d6d0', style: 'elder' },
    hint: () => '工坊在下面的「建造」裡。家具擺錯了也能收回來重新放——訂正也是這樣。',
    rest: '不需要完美的一天，真實的五分鐘也是進步。'
  }
];

export function npcById(id) {
  return NPCS.find(n => n.id === id) || null;
}

export function friendshipLabel(n) {
  return n >= 6 ? '好朋友' : n >= 3 ? '熟識' : '認識';
}

// ctx：{ talkedToday, friendship, shellsToday, shellsTotal }
export function linesFor(npc, ctx) {
  const t = theme(), g = t.greet, own = (t.lines && t.lines[npc.id]) || npc;
  const lines = [];
  if (ctx.talkedToday) lines.push(g.again);
  else if ((ctx.friendship || 0) <= 1) lines.push(g.first(npcName(npc.id)));
  else if (ctx.friendship >= 6) lines.push(g.close);
  else lines.push(g.mid);
  lines.push(own.hint(ctx));
  lines.push(own.rest);
  return lines;
}

// 相容 Demo A 的呼叫方式。
export function chestnutLines({ shellsToday, shellsTotalToday, talkedToday }) {
  return linesFor(NPCS[0], { shellsToday, shellsTotal: shellsTotalToday, talkedToday, friendship: talkedToday ? 2 : 0 });
}

// 居民在 home 周圍 range 格內慢慢走動；回傳下一個目標格或 null（原地停留）。
export function wanderStep(npc, pos, canWalk, rand = Math.random) {
  if (rand() < 0.35) return null;
  const opts = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    .map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }))
    .filter(p => Math.abs(p.x - npc.home.x) + Math.abs(p.y - npc.home.y) <= npc.range && canWalk(p.x, p.y));
  if (!opts.length) return null;
  return opts[Math.floor(rand() * opts.length)];
}
