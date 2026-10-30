// v4 存檔格式與所有會改變存檔的動作。每個動作都是「讀取 → 檢查 → 修改」的純函式，
// 由 persistence.mutate() 包在同一個 IndexedDB 交易中執行，因此多分頁也不會重複發獎。
import { isWalkable, SPAWN } from './world/map.js';
import { spotById, isCollected, SPOTS } from './collectibles.js';
import { emptyInventory, addMaterial, count } from './inventory.js';

export const SCHEMA = 'probation-study-island-v4';
export const VERSION = 1;
export const OUTFITS = [
  { id: 'leaf', name: '葉綠', shirt: '#5f9e6e', trim: '#3f7350' },
  { id: 'sky', name: '天藍', shirt: '#5b93c7', trim: '#3a6b99' },
  { id: 'berry', name: '莓紅', shirt: '#c96b6b', trim: '#984747' }
];
const FACINGS = ['up', 'down', 'left', 'right'];

export function createSave(now = new Date()) {
  return {
    schema: SCHEMA,
    version: VERSION,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    islandName: '小樹灣',
    player: { x: SPAWN.x, y: SPAWN.y, facing: 'down', outfit: 'leaf' },
    inventory: emptyInventory(),
    collected: {},
    npc: {},
    rewardLedger: {}
  };
}

// 讀進來的存檔逐欄修正；無法辨識的欄位以預設值補上，而不是讓遊戲壞掉。
export function normalizeSave(raw) {
  const base = createSave();
  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA) return base;
  const s = { ...base, ...raw };
  const p = raw.player || {};
  s.player = {
    x: p.x, y: p.y,
    facing: FACINGS.includes(p.facing) ? p.facing : 'down',
    outfit: OUTFITS.some(o => o.id === p.outfit) ? p.outfit : 'leaf'
  };
  if (!isWalkable(s.player.x, s.player.y)) Object.assign(s.player, { x: SPAWN.x, y: SPAWN.y });
  const inv = emptyInventory();
  const rinv = raw.inventory || {};
  for (const id of Object.keys(inv.materials)) inv.materials[id] = count(rinv, id);
  if (rinv.furniture && typeof rinv.furniture === 'object') {
    inv.furniture = {};
    for (const [id, n] of Object.entries(rinv.furniture)) if (Number.isInteger(n) && n > 0) inv.furniture[id] = n;
  }
  s.inventory = inv;
  s.collected = raw.collected && typeof raw.collected === 'object' ? raw.collected : {};
  s.npc = raw.npc && typeof raw.npc === 'object' ? raw.npc : {};
  s.rewardLedger = raw.rewardLedger && typeof raw.rewardLedger === 'object' ? raw.rewardLedger : {};
  return s;
}

// 只保留今天的採集紀錄，舊日期自然失效（每日更新）。
function pruneCollected(save, date) {
  for (const d of Object.keys(save.collected)) if (d !== date) delete save.collected[d];
}

// 套用動作，回傳 { changed, ok, reason?, ... }。會直接修改 save。
export function applyAction(save, action, now = new Date()) {
  const touch = r => { if (r.changed) save.updatedAt = now.toISOString(); return r; };
  switch (action.type) {
    case 'collect': {
      const spot = spotById(action.spotId);
      if (!spot) return { changed: false, ok: false, reason: 'unknown-spot' };
      pruneCollected(save, action.date);
      if (isCollected(save, spot.id, action.date)) return { changed: false, ok: false, reason: 'already' };
      (save.collected[action.date] ||= []).push(spot.id);
      const total = addMaterial(save.inventory, spot.material, 1);
      return touch({ changed: true, ok: true, material: spot.material, total });
    }
    case 'move': {
      if (!isWalkable(action.x, action.y)) return { changed: false, ok: false, reason: 'unsafe' };
      const p = save.player;
      if (p.x === action.x && p.y === action.y && p.facing === action.facing) return { changed: false, ok: true };
      Object.assign(p, { x: action.x, y: action.y, facing: FACINGS.includes(action.facing) ? action.facing : p.facing });
      return touch({ changed: true, ok: true });
    }
    case 'talk': {
      const rec = save.npc[action.npcId] ||= {};
      const talkedToday = rec.lastTalkDate === action.date;
      rec.lastTalkDate = action.date;
      return touch({ changed: !talkedToday, ok: true, talkedToday });
    }
    case 'outfit': {
      if (!OUTFITS.some(o => o.id === action.outfit)) return { changed: false, ok: false, reason: 'unknown-outfit' };
      if (save.player.outfit === action.outfit) return { changed: false, ok: true };
      save.player.outfit = action.outfit;
      return touch({ changed: true, ok: true });
    }
    default:
      return { changed: false, ok: false, reason: 'unknown-action' };
  }
}

export function shellsCollectedToday(save, date) {
  const list = (save.collected && save.collected[date]) || [];
  return SPOTS.filter(s => s.material === 'shell' && list.includes(s.id)).length;
}
