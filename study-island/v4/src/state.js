// v4 存檔格式與所有會改變存檔的動作。每個動作都是「讀取 → 檢查 → 修改」的純函式，
// 由 persistence.mutate() 包在同一個 IndexedDB 交易中執行，因此多分頁也不會重複發獎。
import { isWalkable, SPAWN } from './world/map.js';
import { canPlace, furnitureAt } from './world/placement.js';
import { spotById, isCollected, collectedCount } from './collectibles.js';
import { emptyInventory, addMaterial, count, furnitureById, furnitureCount, addFurniture } from './inventory.js';
import { recipeById, missing } from './crafting.js';
import { questById, questStatus, ledgerKey } from './quests.js';
import { npcById } from './npc/dialogue.js';
import { focusOption, studyTask, studyKey, focusKey, focusRemaining } from './learning.js';
import { normalizeLegacy, applyLegacy } from './migration.js';

export const SCHEMA = 'probation-study-island-v4';
export const VERSION = 1;
// 外觀主題只影響顯示；所有規則與進度在兩種主題間共用。
export const THEME_IDS = ['island', 'xianxia'];
export const OUTFITS = [
  { id: 'leaf', name: '葉綠', shirt: '#5f9e6e', trim: '#3f7350' },
  { id: 'sky', name: '天藍', shirt: '#5b93c7', trim: '#3a6b99' },
  { id: 'berry', name: '莓紅', shirt: '#c96b6b', trim: '#984747' }
];
const FACINGS = ['up', 'down', 'left', 'right'];
const MAX_FRIENDSHIP = 10;

export function createSave(now = new Date()) {
  return {
    schema: SCHEMA,
    version: VERSION,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    islandName: '小樹灣',
    player: { x: SPAWN.x, y: SPAWN.y, facing: 'down', outfit: 'leaf' },
    inventory: emptyInventory(),
    placed: [],
    nextUid: 1,
    collected: {},
    daily: null,
    focus: null,
    legacy: null,
    theme: 'island',
    npc: {},
    rewardLedger: {}
  };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// 讀進來的存檔逐欄修正；無法辨識的欄位以預設值補上，而不是讓遊戲壞掉。
export function normalizeSave(raw) {
  const base = createSave();
  if (!isObj(raw) || raw.schema !== SCHEMA) return base;
  const s = { ...base, ...raw };
  const p = raw.player || {};
  s.player = {
    x: p.x, y: p.y,
    facing: FACINGS.includes(p.facing) ? p.facing : 'down',
    outfit: OUTFITS.some(o => o.id === p.outfit) ? p.outfit : 'leaf'
  };
  const inv = emptyInventory();
  const rinv = raw.inventory || {};
  for (const id of Object.keys(inv.materials)) inv.materials[id] = count(rinv, id);
  if (isObj(rinv.furniture)) {
    inv.furniture = {};
    for (const [id, n] of Object.entries(rinv.furniture)) if (Number.isInteger(n) && n > 0) inv.furniture[id] = n;
  }
  s.inventory = inv;
  // 擺放中的家具：資料不合理（未知 ID、位置不可走、重疊）時收回背包，絕不靜默丟棄。
  s.placed = [];
  let maxUid = 0;
  for (const item of Array.isArray(raw.placed) ? raw.placed : []) {
    if (!isObj(item) || !furnitureById(item.id)) continue;
    const uid = Number.isInteger(item.uid) && item.uid > 0 && !s.placed.some(x => x.uid === item.uid) ? item.uid : 0;
    if (uid && isWalkable(item.x, item.y) && !furnitureAt(s, item.x, item.y)) {
      s.placed.push({ uid, id: item.id, x: item.x, y: item.y });
      maxUid = Math.max(maxUid, uid);
    } else {
      addFurniture(s.inventory, item.id, 1);
    }
  }
  s.nextUid = Math.max(Number.isInteger(raw.nextUid) ? raw.nextUid : 1, maxUid + 1);
  if (!isWalkable(s.player.x, s.player.y) || furnitureAt(s, s.player.x, s.player.y)) Object.assign(s.player, { x: SPAWN.x, y: SPAWN.y });
  s.collected = isObj(raw.collected) ? raw.collected : {};
  const d = raw.daily;
  s.daily = isObj(d) && typeof d.date === 'string'
    ? {
      date: d.date,
      talked: Array.isArray(d.talked) ? d.talked.filter(id => npcById(id)) : [],
      crafted: Number.isInteger(d.crafted) ? d.crafted : 0,
      focus: isObj(d.focus) ? Object.fromEntries(Object.entries(d.focus).filter(([, n]) => Number.isInteger(n) && n > 0)) : {}
    }
    : null;
  const f = raw.focus;
  s.focus = isObj(f) && focusOption(f.minutes) && typeof f.startedAt === 'string' && !Number.isNaN(Date.parse(f.startedAt))
    ? { minutes: f.minutes, startedAt: f.startedAt } : null;
  s.npc = isObj(raw.npc) ? raw.npc : {};
  s.legacy = raw.legacy ? normalizeLegacy(raw.legacy) : null;
  s.theme = THEME_IDS.includes(raw.theme) ? raw.theme : 'island';
  s.rewardLedger = isObj(raw.rewardLedger) ? raw.rewardLedger : {};
  return s;
}

// 只保留今天的採集紀錄與每日統計，舊日期自然失效（每日更新）。
function rollDay(save, date) {
  for (const d of Object.keys(save.collected)) if (d !== date) delete save.collected[d];
  if (!save.daily || save.daily.date !== date) save.daily = { date, talked: [], crafted: 0, focus: {} };
  save.daily.focus ||= {};
  const old = Date.parse(date) - 2 * 86400000;
  for (const k of Object.keys(save.rewardLedger)) {
    const [kind, rest] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    if ((kind === 'quest' || kind === 'study') && !rest.startsWith(date + ':')) delete save.rewardLedger[k];
    else if (kind === 'focus' && Date.parse(rest) < old) delete save.rewardLedger[k];
  }
}

function befriend(save, npcId) {
  const rec = save.npc[npcId] ||= {};
  rec.friendship = Math.min(MAX_FRIENDSHIP, (Number.isInteger(rec.friendship) ? rec.friendship : 0) + 1);
  return rec.friendship;
}

function grant(save, reward) {
  for (const [id, n] of Object.entries(reward)) addMaterial(save.inventory, id, n);
}

// 套用動作，回傳 { changed, ok, reason?, ... }。會直接修改 save。
export function applyAction(save, action, now = new Date()) {
  const touch = r => { if (r.changed) save.updatedAt = now.toISOString(); return r; };
  const fail = reason => ({ changed: false, ok: false, reason });
  switch (action.type) {
    case 'collect': {
      const spot = spotById(action.spotId);
      if (!spot) return fail('unknown-spot');
      rollDay(save, action.date);
      if (isCollected(save, spot.id, action.date)) return fail('already');
      (save.collected[action.date] ||= []).push(spot.id);
      const total = addMaterial(save.inventory, spot.material, 1);
      return touch({ changed: true, ok: true, material: spot.material, total });
    }
    case 'move': {
      if (!isWalkable(action.x, action.y) || furnitureAt(save, action.x, action.y)) return fail('unsafe');
      const p = save.player;
      if (p.x === action.x && p.y === action.y && p.facing === action.facing) return { changed: false, ok: true };
      Object.assign(p, { x: action.x, y: action.y, facing: FACINGS.includes(action.facing) ? action.facing : p.facing });
      return touch({ changed: true, ok: true });
    }
    case 'talk': {
      if (!npcById(action.npcId)) return fail('unknown-npc');
      rollDay(save, action.date);
      const rec = save.npc[action.npcId] ||= {};
      const talkedToday = save.daily.talked.includes(action.npcId) || rec.lastTalkDate === action.date;
      if (talkedToday) return { changed: false, ok: true, talkedToday, friendship: rec.friendship || 0 };
      rec.lastTalkDate = action.date;
      save.daily.talked.push(action.npcId);
      return touch({ changed: true, ok: true, talkedToday: false, friendship: befriend(save, action.npcId) });
    }
    case 'setTheme': {
      if (!THEME_IDS.includes(action.theme)) return fail('unknown-theme');
      if (save.theme === action.theme) return { changed: false, ok: true };
      save.theme = action.theme;
      return touch({ changed: true, ok: true });
    }
    case 'outfit': {
      if (!OUTFITS.some(o => o.id === action.outfit)) return fail('unknown-outfit');
      if (save.player.outfit === action.outfit) return { changed: false, ok: true };
      save.player.outfit = action.outfit;
      return touch({ changed: true, ok: true });
    }
    case 'craft': {
      const r = recipeById(action.recipeId);
      if (!r) return fail('unknown-recipe');
      const lack = missing(save.inventory, r);
      if (lack.length) return { ...fail('missing'), missing: lack };
      rollDay(save, action.date);
      for (const [id, n] of Object.entries(r.needs)) save.inventory.materials[id] -= n;
      const qty = addFurniture(save.inventory, r.makes, 1);
      save.daily.crafted += 1;
      return touch({ changed: true, ok: true, item: r.makes, qty });
    }
    case 'place': {
      if (!furnitureById(action.itemId)) return fail('unknown-item');
      if (furnitureCount(save.inventory, action.itemId) < 1) return fail('none-left');
      const chk = canPlace(save, action.x, action.y, action.actors || []);
      if (!chk.ok) return fail(chk.reason);
      const uid = save.nextUid++;
      save.placed.push({ uid, id: action.itemId, x: action.x, y: action.y });
      addFurniture(save.inventory, action.itemId, -1);
      return touch({ changed: true, ok: true, uid });
    }
    case 'pickup': {
      const i = save.placed.findIndex(p => p.uid === action.uid);
      if (i < 0) return fail('not-placed');
      const [item] = save.placed.splice(i, 1);
      addFurniture(save.inventory, item.id, 1);
      return touch({ changed: true, ok: true, item: item.id });
    }
    case 'claimQuest': {
      const q = questById(action.questId);
      if (!q) return fail('unknown-quest');
      rollDay(save, action.date);
      const st = questStatus(save, q, action.date);
      if (st.claimed) return fail('already');
      if (!st.done) return fail('not-done');
      grant(save, q.reward);
      save.rewardLedger[ledgerKey(q.id, action.date)] = now.toISOString();
      return touch({ changed: true, ok: true, reward: q.reward });
    }
    // ── 階段 C：專注計時（以開始時間 + 裝置時鐘判斷；只有時間到才給，且同一次專注只結算一次） ──
    case 'focusStart': {
      if (!focusOption(action.minutes)) return fail('unknown-focus');
      if (save.focus) return fail('running');
      save.focus = { minutes: action.minutes, startedAt: now.toISOString() };
      return touch({ changed: true, ok: true, focus: save.focus });
    }
    case 'focusCancel': {
      if (!save.focus) return fail('none');
      save.focus = null;
      return touch({ changed: true, ok: true });
    }
    case 'focusComplete': {
      const f = save.focus;
      if (!f) return fail('none');
      if (focusRemaining(save, now.getTime()) > 0) return fail('not-yet');
      const opt = focusOption(f.minutes), key = focusKey(f.startedAt);
      rollDay(save, action.date);
      save.focus = null;
      if (save.rewardLedger[key]) return touch({ changed: true, ok: false, reason: 'already' });
      save.rewardLedger[key] = now.toISOString();
      const done = save.daily.focus[f.minutes] || 0;
      save.daily.focus[f.minutes] = done + 1;
      if (done >= opt.dailyCap) return touch({ changed: true, ok: true, minutes: f.minutes, capped: true, reward: {} });
      grant(save, opt.reward);
      const friendship = befriend(save, opt.npc);
      return touch({ changed: true, ok: true, minutes: f.minutes, capped: false, reward: opt.reward, npc: opt.npc, friendship });
    }
    // ── 學習任務：v4.0 為使用者自行回報；每項每天一次 ──
    case 'studyReport': {
      const t = studyTask(action.taskId);
      if (!t) return fail('unknown-task');
      rollDay(save, action.date);
      const key = studyKey(t.id, action.date);
      if (save.rewardLedger[key]) return fail('already');
      save.rewardLedger[key] = now.toISOString();
      grant(save, t.reward);
      const friendship = befriend(save, t.npc);
      return touch({ changed: true, ok: true, reward: t.reward, npc: t.npc, friendship, selfReported: true });
    }
    // ── 階段 D：v3 舊島轉入「舊島花園」，只做一次 ──
    case 'migrateV1': {
      const legacy = normalizeLegacy(action.legacy);
      if (!legacy) return fail('invalid');
      return touch(applyLegacy(save, legacy));
    }
    default:
      return fail('unknown-action');
  }
}

export function shellsCollectedToday(save, date) {
  return collectedCount(save, date, 'shell');
}

export function talkedToday(save, npcId, date) {
  return (save.npc[npcId] || {}).lastTalkDate === date;
}
