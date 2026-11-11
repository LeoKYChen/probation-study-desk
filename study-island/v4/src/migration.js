// 階段 D：v3（localStorage["probationStudyIsland.v1"]）舊島資料轉入 v4「舊島花園」，以及 v4 備份格式。
// 原則：v1 原資料只讀不改不刪；所有家具、數量、貝殼、親密度、成就都保留；
// 放不進 6×6 花園的東西放「待整理倉庫」，絕不靜默丟棄。
import { normalizeSave, SCHEMA } from './state.js';

export const V1_KEY = 'probationStudyIsland.v1';
export const BACKUP_FORMAT = 'probation-study-island-v4-backup';
export const MAX_IMPORT_BYTES = 1024 * 1024;

// v3 商店裝飾與固定景物（數值照抄 v3，只用於顯示）。
export const V1_GOODS = {
  flower: { name: '花圃', icon: '🌷' },
  tree: { name: '小樹', icon: '🌳' },
  bench: { name: '木椅', icon: '🪑' },
  tent: { name: '帳篷', icon: '⛺' },
  garden: { name: '蘑菇園', icon: '🍄' },
  lamp: { name: '小燈籠', icon: '🏮' }
};
export const V1_FIXED = { 2: '🌲', 8: '🏡', 13: '🌻', 20: '🌲', 27: '🌿', 34: '🌲' };
export const V1_HEARTS = { fox: 'chestnut', bear: 'brownie', bunny: 'snowy', owl: 'inky' };
const V1_HEARTS_NAME = { fox: '栗子', bear: '阿棕', bunny: '小白', owl: '墨墨' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const int = (n, max) => (Number.isSafeInteger(n) ? Math.max(0, Math.min(max, n)) : 0);

export function isV1(raw) {
  return isObj(raw) && raw.version === 1 && Array.isArray(raw.plots);
}

// v3 的徽章規則（照 v3 畫面計算），讓成就在 v4 也看得到。
export function v1Badges(v) {
  const lv = 1 + Math.floor(v.xp / 120);
  return [
    { label: '🌱 第一天', ok: v.days.length >= 1 },
    { label: '🌸 三日萌芽', ok: v.days.length >= 3 },
    { label: '🌳 七日森林', ok: v.days.length >= 7 },
    { label: '🏡 村莊 Lv.3', ok: lv >= 3 },
    { label: '✨ 星光居民', ok: Object.values(v.hearts).some(n => n >= 5) }
  ].filter(b => b.ok).map(b => b.label);
}

// 把 v3 資料轉成 v4 的舊島紀錄。格式不相容時丟出中文錯誤。
export function legacyFromV1(raw, { source = 'file', now = new Date() } = {}) {
  if (!isV1(raw)) throw new Error('這不是 v3 小島的備份（找不到 version 1 與 plots）。');
  if (raw.plots.length > 400) throw new Error('v3 備份的地塊數量不合理。');
  const storage = {};
  const stash = (id, n = 1) => { storage[id] = (storage[id] || 0) + n; };
  const garden = Array(36).fill('');
  const conflicts = [];
  raw.plots.forEach((id, i) => {
    if (!id) return;
    const key = String(id).slice(0, 40);
    // 不在 6×6 範圍、落在固定景物格，或不認得的 ID：全部放進待整理倉庫。
    if (i >= 36 || V1_FIXED[i] || !V1_GOODS[key]) { stash(key); conflicts.push({ index: i, id: key }); return; }
    garden[i] = key;
  });
  if (isObj(raw.owned)) for (const [id, n] of Object.entries(raw.owned)) { const c = int(n, 1000); if (c) stash(String(id).slice(0, 40), c); }
  const hearts = {};
  for (const k of Object.keys(V1_HEARTS)) hearts[k] = int(isObj(raw.hearts) ? raw.hearts[k] : 0, 99);
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter(d => typeof d === 'string' && DATE.test(d)))].slice(-2000) : [];
  const xp = int(raw.xp, 1000000);
  const legacy = {
    source,
    importedAt: now.toISOString(),
    islandName: typeof raw.islandName === 'string' && raw.islandName.trim() ? raw.islandName.trim().slice(0, 14) : '小樹灣',
    shells: int(raw.coins, 1000000),
    xp,
    garden,
    storage,
    conflicts,
    hearts,
    days,
    badges: [],
    history: Array.isArray(raw.history) ? raw.history.filter(x => typeof x === 'string').slice(0, 30).map(x => x.slice(0, 160)) : [],
    weeklyClaimed: Array.isArray(raw.weeklyClaimed) ? raw.weeklyClaimed.filter(x => typeof x === 'string' && DATE.test(x)).slice(-150) : []
  };
  legacy.badges = v1Badges({ xp, days, hearts });
  return legacy;
}

// 預覽用的摘要（確認前顯示，不寫入任何東西）。
export function legacySummary(l) {
  const placed = l.garden.filter(Boolean).length;
  const stored = Object.values(l.storage).reduce((a, b) => a + b, 0);
  return {
    islandName: l.islandName,
    shells: l.shells,
    placed,
    stored,
    conflicts: l.conflicts.length,
    hearts: Object.entries(l.hearts).map(([k, n]) => V1_HEARTS_NAME[k] + ' ' + n),
    days: l.days.length,
    badges: l.badges
  };
}

// 把舊島紀錄套進 v4 存檔：只新增 legacy 欄位，並把親密度提高到 max(v4, min(10, v3))。
// 舊島貝殼保留在舊島紀錄中顯示，不加進 v4 的材料（v4 貝殼是製作材料，避免一次湧入打亂經營節奏）。
export function applyLegacy(save, legacy) {
  if (save.legacy) return { changed: false, ok: false, reason: 'already' };
  save.legacy = legacy;
  for (const [k, npcId] of Object.entries(V1_HEARTS)) {
    const rec = save.npc[npcId] ||= {};
    rec.friendship = Math.max(Number.isInteger(rec.friendship) ? rec.friendship : 0, Math.min(10, legacy.hearts[k] || 0));
  }
  return { changed: true, ok: true };
}

export function normalizeLegacy(l) {
  if (!isObj(l) || !Array.isArray(l.garden) || l.garden.length !== 36) return null;
  return {
    ...l,
    garden: l.garden.map(id => (typeof id === 'string' ? id.slice(0, 40) : '')),
    storage: isObj(l.storage) ? Object.fromEntries(Object.entries(l.storage).filter(([, n]) => Number.isSafeInteger(n) && n > 0)) : {},
    conflicts: Array.isArray(l.conflicts) ? l.conflicts : [],
    hearts: isObj(l.hearts) ? l.hearts : {},
    days: Array.isArray(l.days) ? l.days : [],
    badges: Array.isArray(l.badges) ? l.badges.filter(b => typeof b === 'string') : [],
    history: Array.isArray(l.history) ? l.history : [],
    weeklyClaimed: Array.isArray(l.weeklyClaimed) ? l.weeklyClaimed : [],
    shells: int(l.shells, 1000000)
  };
}

// ── v4 備份 ──
export function makeBackup(save, now = new Date()) {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), note: '觀護學習島 v4 小島資料；不含考古題答案或其他學習紀錄。', save };
}

// 讀取使用者選的 JSON：回傳 { kind: 'v4', save } 或 { kind: 'v1', legacy }；格式不對丟出中文錯誤。
export function parseImport(text, opts) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) throw new Error('檔案過大（限 1 MB）。');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('檔案不是有效的 JSON。'); }
  if (isObj(raw) && raw.format === BACKUP_FORMAT) {
    if (raw.version !== 1) throw new Error('這是較新版本的 v4 備份，目前版本無法讀取。');
    if (!isObj(raw.save) || raw.save.schema !== SCHEMA) throw new Error('v4 備份內容不完整。');
    return { kind: 'v4', save: normalizeSave(raw.save) };
  }
  if (isObj(raw) && raw.schema === SCHEMA) return { kind: 'v4', save: normalizeSave(raw) };
  if (isV1(raw)) return { kind: 'v1', legacy: legacyFromV1(raw, opts) };
  throw new Error('認不得這個檔案：不是 v4 備份，也不是 v3 小島匯出的 JSON。');
}

export function saveSummary(s) {
  return {
    islandName: s.islandName,
    materials: s.inventory.materials,
    furniture: Object.values(s.inventory.furniture).reduce((a, b) => a + b, 0),
    placed: s.placed.length,
    friendship: Object.entries(s.npc).map(([id, r]) => [id, r.friendship || 0]),
    legacy: !!s.legacy,
    updatedAt: s.updatedAt
  };
}
