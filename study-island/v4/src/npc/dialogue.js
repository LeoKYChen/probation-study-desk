// 原創居民與對話。對話只做學習鼓勵與遊戲引導，不含需查證的法律或學理內容。
export const NPCS = [
  {
    id: 'chestnut',
    name: '栗子',
    subject: '少年事件處理法',
    home: { x: 12, y: 9 },
    range: 2,
    colors: { body: '#d9844a', belly: '#fbe6cc', ear: '#8a4a2b', scarf: '#5c9a8a' }
  }
];

export function npcById(id) {
  return NPCS.find(n => n.id === id) || null;
}

// 依今天撿了幾個貝殼、今天是否已打過招呼，回傳一串對話。
export function chestnutLines({ shellsToday, shellsTotalToday, talkedToday, name = '你' }) {
  const lines = [];
  lines.push(talkedToday ? '又見面了！今天的風好舒服。' : '嗨，' + name + '！我是栗子，住在廣場旁邊。');
  if (shellsToday === 0) {
    lines.push('南邊的沙灘上有 ' + shellsTotalToday + ' 個貝殼在閃閃發光，去看看吧？');
  } else if (shellsToday < shellsTotalToday) {
    lines.push('你已經找到 ' + shellsToday + ' 個貝殼了，還剩 ' + (shellsTotalToday - shellsToday) + ' 個藏在沙灘。');
  } else {
    lines.push('今天的貝殼都被你找到了！明天海浪會再帶來新的。');
  }
  lines.push('讀書累了就來島上走走，休息也是進步的一部分喔。');
  return lines;
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
