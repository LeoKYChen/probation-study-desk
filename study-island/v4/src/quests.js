// 每日遊戲委託。進度由存檔自動核對；每項每天只能領一次（獎勵帳本以 quest:日期:ID 去重）。
// 不需要先讀書也能完成；學習任務（自行回報）在之後的階段 C 加入。
import { collectedCount } from './collectibles.js';

export const QUESTS = [
  {
    id: 'shells2', giver: 'snowy', icon: '🐚', title: '撿 2 個貝殼', target: 2,
    progress: (save, date) => collectedCount(save, date, 'shell'),
    reward: { leaf: 1 }
  },
  {
    id: 'talk2', giver: 'brownie', icon: '💬', title: '和 2 位居民聊天', target: 2,
    progress: (save, date) => (save.daily && save.daily.date === date ? save.daily.talked.length : 0),
    reward: { wood: 1 }
  },
  {
    id: 'craft1', giver: 'inky', icon: '🔨', title: '在工坊製作 1 件家具', target: 1,
    progress: (save, date) => (save.daily && save.daily.date === date ? save.daily.crafted : 0),
    reward: { shell: 2 }
  }
];

export function questById(id) {
  return QUESTS.find(q => q.id === id) || null;
}

export const ledgerKey = (questId, date) => 'quest:' + date + ':' + questId;

export function questStatus(save, quest, date) {
  const progress = Math.min(quest.target, quest.progress(save, date));
  const claimed = !!(save.rewardLedger && save.rewardLedger[ledgerKey(quest.id, date)]);
  return { progress, done: progress >= quest.target, claimed };
}
