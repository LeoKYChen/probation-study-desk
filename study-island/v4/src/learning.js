// 階段 C：專注計時與學習任務。
// v4.0 一律「自行回報」：遊戲不讀取考古題、書桌或主動回憶的資料，只給往返連結。
// 獎勵是材料、少量貝殼與居民親密度；每項每天有上限，休息不扣任何資源。

export const FOCUS_OPTIONS = [
  { minutes: 5, dailyCap: 3, reward: { shell: 1, leaf: 1 }, npc: 'brownie' },
  { minutes: 25, dailyCap: 2, reward: { shell: 3, wood: 1, leaf: 1 }, npc: 'brownie' }
];

export const STUDY_TASKS = [
  {
    id: 'essay', icon: '✍️', title: '完成一題申論', npc: 'chestnut',
    reward: { shell: 2, wood: 1 }, link: { href: '../../v2.5/', label: '去考古題練習' }
  },
  {
    id: 'correction', icon: '📝', title: '完成一次訂正', npc: 'inky',
    reward: { shell: 1, leaf: 1 }, link: { href: '../../study-desk/', label: '去備考書桌' }
  },
  {
    id: 'recall', icon: '💡', title: '完成一次主動回憶', npc: 'snowy',
    reward: { shell: 1, fruit: 1 }, link: { href: '../../active-recall/', label: '去主動回憶' }
  }
];

export const focusOption = minutes => FOCUS_OPTIONS.find(f => f.minutes === minutes) || null;
export const studyTask = id => STUDY_TASKS.find(t => t.id === id) || null;

export const studyKey = (id, date) => 'study:' + date + ':' + id;
export const focusKey = startedAt => 'focus:' + startedAt;

// 剩餘毫秒；沒有進行中的專注回傳 null。以裝置時鐘計算，重新整理或切換分頁後可接續。
export function focusRemaining(save, now = Date.now()) {
  const f = save.focus;
  if (!f) return null;
  return Math.max(0, Date.parse(f.startedAt) + f.minutes * 60000 - now);
}

export function focusDoneToday(save, minutes, date) {
  const d = save.daily && save.daily.date === date ? save.daily : null;
  return d && d.focus ? d.focus[minutes] || 0 : 0;
}

export function studyDoneToday(save, id, date) {
  return !!(save.rewardLedger && save.rewardLedger[studyKey(id, date)]);
}

export function formatMs(ms) {
  const s = Math.ceil(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
