// 主程式：輸入、移動、居民、採集、工坊／擺放、委託、存檔與繪製迴圈的接線。
import { MAP_W, MAP_H, isWalkable, tileAt } from './world/map.js';
import { findPath, pathToNeighbor, dirBetween, DIRS } from './player/pathfinding.js';
import { NPCS, linesFor, wanderStep, npcById } from './npc/dialogue.js';
import { availableSpots, spotAt, localDate, collectedCount, spotTotal } from './collectibles.js';
import { MATERIALS, furnitureById } from './inventory.js';
import { recipeById } from './crafting.js';
import { questById } from './quests.js';
import { isOpen, furnitureAt, canPlace, PLACE_REASONS } from './world/placement.js';
import { OUTFITS, talkedToday } from './state.js';
import { studyTask, focusRemaining } from './learning.js';
import { openStore } from './persistence.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';

const PLAYER_SPEED = 4.5, NPC_SPEED = 1.6;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = document.getElementById('game');
const world = document.getElementById('world');
const ui = createUI();
const renderer = createRenderer(canvas);

let store;
try { store = await openStore(); } catch { store = await openStore({ idb: null }); }
let save;
try { save = await store.load(); } catch { store = await openStore({ idb: null }); save = await store.load(); }
if (!store.persistent) ui.banner('這個瀏覽器目前無法儲存小島進度（可能是無痕模式或儲存空間被封鎖）。可以先玩，但重新整理後會消失。');

const today = () => localDate();
const mover = (o, x, y, facing) => Object.assign(o, { x, y, rx: x, ry: y, facing, moving: false, from: null, to: null, t: 0 });
const player = mover({ path: [], onArrive: null }, save.player.x, save.player.y, save.player.facing);
const npcs = NPCS.map(n => mover({ ...n }, n.home.x, n.home.y, 'down'));
const effects = [];
const held = [];
const pending = new Set();
let marker = null, lastBump = 0, saveTimer = 0, talking = null, approaching = null, placing = null;
const matOf = id => MATERIALS.find(m => m.id === id);

// ── 碰撞：地形 + 居民／玩家目前與即將抵達的格子 ──
const occupied = (o, x, y) => (o.x === x && o.y === y) || (o.to && o.to.x === x && o.to.y === y);
const freeForPlayer = (x, y) => isOpen(save, x, y) && !npcs.some(n => occupied(n, x, y));
const freeForNpc = (x, y) => isOpen(save, x, y) && !occupied(player, x, y) && !npcs.some(n => occupied(n, x, y));
const npcAt = (x, y) => npcs.find(n => occupied(n, x, y)) || null;
const playerTile = () => (player.moving ? player.to : player);
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

function startStep(o, to) {
  o.facing = dirBetween(o, to) || o.facing;
  o.from = { x: o.x, y: o.y };
  o.to = to;
  o.t = 0;
  o.moving = true;
}

function finishStep(o) {
  o.x = o.to.x; o.y = o.to.y; o.rx = o.x; o.ry = o.y;
  o.moving = false; o.from = null; o.to = null;
}

function blockedFeedback(x, y, why) {
  marker = { x, y, kind: 'blocked', life: 1 };
  const now = performance.now();
  if (now - lastBump > 900) { ui.toast(why); lastBump = now; }
}

function obstacleMessage(x, y) {
  const t = tileAt(x, y);
  if (t.id === 'water') return '那裡是海，走不過去。';
  if (t.id === 'house') return '這是你的小屋，之後會開放進去。';
  return t.label + '擋住了，換條路走吧。';
}

function tryStep(dir) {
  const d = DIRS[dir], nx = player.x + d.dx, ny = player.y + d.dy;
  player.facing = dir;
  if (freeForPlayer(nx, ny)) { startStep(player, { x: nx, y: ny }); return true; }
  const n = npcAt(nx, ny), f = furnitureAt(save, nx, ny);
  blockedFeedback(nx, ny, n ? n.name + '在這裡，按 E 或「互動」可以聊天。' : f ? furnitureById(f.id).name + '擋住了。' : obstacleMessage(nx, ny));
  return false;
}

function walkTo(path, onArrive, target = null) {
  approaching = target;
  player.path = path;
  player.onArrive = onArrive || null;
  if (path.length) marker = { ...path[path.length - 1], kind: 'goal', life: 1 };
  else if (onArrive) { player.onArrive = null; onArrive(); }
  poke();
}

// ── 點擊地圖：走路、找居民、撿貝殼或提示障礙 ──
// 居民圖像比一格高（頭在上一格），以實際畫出的範圍判斷是否點到居民。
const npcHit = (fx, fy) => npcs.find(n => fx >= n.rx - .1 && fx <= n.rx + 1.1 && fy >= n.ry - .6 && fy <= n.ry + 1) || null;

function onTap(tx, ty, fx = tx + .5, fy = ty + .5) {
  if (ui.dialogueOpen || ui.panel) return;
  hideHint();
  held.length = 0;
  if (placing) return placeAt(tx, ty);
  const from = playerTile();
  approaching = null;
  const n = npcAt(tx, ty) || npcHit(fx, fy);
  if (n) {
    if (adjacent(from, n) && !player.moving) return talkTo(n);
    const r = pathToNeighbor(from, n, freeForPlayer, MAP_W, MAP_H);
    if (!r) return blockedFeedback(n.x, n.y, '暫時走不到' + n.name + '旁邊。');
    return walkTo(r.path, () => { approaching = null; if (adjacent(player, n)) talkTo(n); }, n);
  }
  const spot = spotAt(tx, ty);
  if (spot && isAvailable(spot)) {
    const p = findPath(from, spot, freeForPlayer, MAP_W, MAP_H);
    if (!p) return blockedFeedback(tx, ty, '暫時走不到那裡。');
    return walkTo(p, () => collect(spot));
  }
  const f = furnitureAt(save, tx, ty);
  if (f) {
    const name = furnitureById(f.id).name;
    if (adjacent(from, f) && !player.moving) { player.facing = dirBetween(player, f) || player.facing; return ui.toast('按 E 或「收起' + name + '」可以收回背包。'); }
    const r = pathToNeighbor(from, f, freeForPlayer, MAP_W, MAP_H);
    if (!r) return blockedFeedback(tx, ty, '暫時走不到' + name + '旁邊。');
    return walkTo(r.path, () => { player.facing = dirBetween(player, f) || player.facing; });
  }
  if (!isWalkable(tx, ty)) return blockedFeedback(tx, ty, obstacleMessage(tx, ty));
  const p = findPath(from, { x: tx, y: ty }, freeForPlayer, MAP_W, MAP_H);
  if (!p) return blockedFeedback(tx, ty, '那裡走不到，試試別的路。');
  walkTo(p);
}

// ── 互動 ──
const isAvailable = spot => availableSpots(save, today()).some(s => s.id === spot.id);

function nearbyTarget() {
  if (player.moving || ui.dialogueOpen || ui.panel) return null;
  const n = npcs.find(x => !x.moving && adjacent(player, x));
  if (n) return { kind: 'npc', npc: n, label: '和' + n.name + '說話' };
  const spot = availableSpots(save, today()).find(s => (s.x === player.x && s.y === player.y) || adjacent(player, s));
  if (spot) return { kind: 'spot', spot, label: '撿起' + matOf(spot.material).name };
  const f = (save.placed || []).find(p => adjacent(player, p));
  if (f) return { kind: 'furniture', item: f, label: '收起' + furnitureById(f.id).name };
  return null;
}

function interact() {
  if (ui.dialogueOpen) return ui.advanceDialogue();
  const t = nearbyTarget();
  if (!t) return;
  if (t.kind === 'npc') talkTo(t.npc);
  else if (t.kind === 'spot') collect(t.spot);
  else pickup(t.item.uid);
}

async function talkTo(n) {
  if (talking) return;
  talking = n;
  player.path = []; player.onArrive = null; held.length = 0;
  player.facing = dirBetween(player, n) || player.facing;
  n.facing = dirBetween(n, player) || n.facing;
  let already = false;
  try {
    const r = await store.mutate({ type: 'talk', npcId: n.id, date: today() });
    save = r.save; already = r.result.talkedToday;
  } catch { /* 對話不是獎勵，存不了也照常聊天 */ }
  const friendship = (save.npc[n.id] || {}).friendship || 0;
  const lines = linesFor(n, { talkedToday: already, friendship, shellsToday: collectedCount(save, today(), 'shell'), shellsTotal: spotTotal('shell') });
  refresh();
  ui.showDialogue(n, lines, () => { talking = null; canvas.focus({ preventScroll: true }); refresh(); }, friendship);
}

// 撿拾：只有 IndexedDB 交易 commit 後才算入袋；同一個採集點處理中時忽略重複點擊。
async function collect(spot) {
  if (pending.has(spot.id)) return;
  if (Math.abs(player.x - spot.x) + Math.abs(player.y - spot.y) > 1) return;
  pending.add(spot.id);
  try {
    const { save: next, result } = await store.mutate({ type: 'collect', spotId: spot.id, date: today() });
    save = next;
    const m = matOf(spot.material);
    if (result.ok) {
      effects.push({ x: spot.x, y: spot.y, text: '+1 ' + m.icon, life: 1 });
      ui.toast('撿到' + m.name + '！背包裡有 ' + result.total + ' 個' + (store.persistent ? '。' : '（未保存）。'));
    } else if (result.reason === 'already') {
      ui.toast('這裡今天已經撿過了。');
    }
  } catch {
    ui.toast('儲存失敗：材料沒有放進背包，請再試一次。', 3500);
    ui.banner('剛才的儲存失敗了，小島進度可能沒有保存。');
  } finally {
    pending.delete(spot.id);
    refresh();
  }
}

// ── 存檔：角色停下來後記住「上次安全位置」 ──
// 閒置時每幀都會呼叫；計時中就不重設，否則永遠存不到。
function schedulePositionSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = 0; savePosition(); }, 500);
}
async function savePosition() {
  if (player.moving) return;
  const p = save.player;
  if (p.x === player.x && p.y === player.y && p.facing === player.facing) return;
  try {
    const r = await store.mutate({ type: 'move', x: player.x, y: player.y, facing: player.facing });
    save = r.save;
  } catch { ui.banner('位置儲存失敗，重新整理後可能會回到上一次的位置。'); }
}

async function setOutfit(id) {
  try {
    const r = await store.mutate({ type: 'outfit', outfit: id });
    save = r.save;
  } catch { ui.toast('衣服顏色儲存失敗。'); }
  refresh();
}

// ── 工坊、擺放、收回、委託：一律經過單次交易；處理中的同一個動作忽略重複點擊 ──
async function act(key, action, onOk, failMsg) {
  if (pending.has(key)) return null;
  pending.add(key);
  try {
    const { save: next, result } = await store.mutate(action);
    save = next;
    if (result.ok) onOk(result); else if (failMsg) ui.toast(failMsg(result));
    return result;
  } catch {
    ui.toast('儲存失敗，這次的變更沒有保存，請再試一次。', 3500);
    ui.banner('剛才的儲存失敗了，小島進度可能沒有保存。');
    return null;
  } finally {
    pending.delete(key);
    refresh();
  }
}

const unsaved = () => (store.persistent ? '' : '（未保存）');

function craft(recipeId) {
  const r = recipeById(recipeId);
  if (!r) return;
  const name = furnitureById(r.makes).name;
  return act('craft:' + recipeId, { type: 'craft', recipeId, date: today() },
    () => ui.toast('做好了一個' + name + '！已放進背包' + unsaved() + '。'),
    res => (res.reason === 'missing' ? '材料不夠：' + res.missing.map(m => matOf(m.id).name + '還差 ' + (m.need - m.have)).join('、') : '現在不能製作。'));
}

function pickup(uid) {
  uid = Number(uid);
  return act('pickup:' + uid, { type: 'pickup', uid },
    res => ui.toast(furnitureById(res.item).name + '收回背包了' + unsaved() + '。'),
    () => '這件家具已經收起來了。');
}

function claim(questId) {
  const q = questById(questId);
  if (!q) return;
  return act('claim:' + questId, { type: 'claimQuest', questId, date: today() },
    res => ui.toast('領到委託獎勵：' + Object.entries(res.reward).map(([id, n]) => matOf(id).icon + '×' + n).join(' ') + unsaved()),
    res => (res.reason === 'already' ? '這個委託今天已經領過了。' : '委託還沒完成。'));
}

// ── 階段 C：專注計時與自行回報的學習任務 ──
const rewardLine = r => Object.entries(r).map(([id, n]) => matOf(id).icon + '×' + n).join(' ');

function startFocus(minutes) {
  return act('focus', { type: 'focusStart', minutes: Number(minutes) },
    () => ui.toast('開始專注 ' + minutes + ' 分鐘。去讀書吧，小島會等你' + unsaved() + '。', 3000),
    res => (res.reason === 'running' ? '已經有一段專注在進行中。' : '現在不能開始。'));
}

function cancelFocus() {
  return act('focus', { type: 'focusCancel' }, () => ui.toast('已取消專注，不給獎勵；隨時可以再開始。'));
}

// 時間到才結算；多分頁同時結算時，交易保證只有一邊拿到獎勵。
let completing = false;
async function completeFocus() {
  if (completing) return;
  completing = true;
  await act('focus', { type: 'focusComplete', date: today() }, res => {
    if (res.capped) ui.toast('專注 ' + res.minutes + ' 分鐘完成！今天這項的獎勵已達上限，但專注本身一樣有價值。', 4000);
    else {
      effects.push({ x: player.x, y: player.y, text: '⏱ ' + rewardLine(res.reward), life: 1 });
      ui.toast('專注 ' + res.minutes + ' 分鐘完成！獲得 ' + rewardLine(res.reward) + '，' + npcById(res.npc).name + '親密度 +1' + unsaved() + '。', 4000);
    }
  });
  completing = false;
}

function reportStudy(taskId) {
  const t = studyTask(taskId);
  if (!t) return;
  return act('study:' + taskId, { type: 'studyReport', taskId, date: today() },
    res => ui.toast('已記錄「' + t.title + '」（自行回報）：' + rewardLine(res.reward) + '，' + npcById(res.npc).name + '親密度 +1' + unsaved() + '。', 3500),
    res => (res.reason === 'already' ? '今天已經回報過了。' : '現在不能回報。'));
}

setInterval(() => {
  if (!save.focus) return;
  ui.focusTick(save);
  if (focusRemaining(save) === 0 && !document.hidden) completeFocus();
}, 1000);

const actors = () => [playerTile(), ...npcs.flatMap(n => [{ x: n.x, y: n.y }, ...(n.to ? [n.to] : [])])];

function startPlacing(itemId) {
  const f = furnitureById(itemId);
  if (!f) return;
  ui.closePanel(false);
  placing = { itemId, hints: [] };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (canPlace(save, x, y, actors()).ok) placing.hints.push({ x, y });
  ui.placeBar('點一塊有白點的空地擺放' + f.name);
  refresh();
}

function stopPlacing() {
  placing = null;
  ui.placeBar('');
  refresh();
}

async function placeAt(x, y) {
  const { itemId } = placing;
  const chk = canPlace(save, x, y, actors());
  if (!chk.ok) return blockedFeedback(x, y, PLACE_REASONS[chk.reason]);
  const res = await act('place', { type: 'place', itemId, x, y, actors: actors() },
    () => { effects.push({ x, y, text: '✨', life: 1 }); ui.toast(furnitureById(itemId).name + '擺好了' + unsaved() + '！靠近按 E 可以收回。'); },
    r => PLACE_REASONS[r.reason] || '這裡不能擺。');
  if (res && res.ok) stopPlacing();
}

// ── 畫面更新 ──
function panelCtx() {
  return {
    save, date: today(), persistent: store.persistent,
    handlers: { outfit: setOutfit, craft, place: startPlacing, pickup, claim, focus: startFocus, focusCancel: cancelFocus, studyConfirm: reportStudy }
  };
}

function refresh() {
  ui.hud(save);
  if (ui.panel) ui.renderPanel(panelCtx());
  const t = nearbyTarget();
  const btn = document.getElementById('interact');
  btn.hidden = !t || !!placing;
  if (t) btn.textContent = t.label + '（E）';
  document.getElementById('dpad').hidden = !dpadOn || ui.dialogueOpen || !!ui.panel || !!placing;
  poke();
}

let hintShown = true;
function hideHint() {
  if (!hintShown) return;
  hintShown = false;
  document.getElementById('hint').hidden = true;
}

// ── 遊戲迴圈：有動作時用 rAF，閒置時降頻，什麼都不動時停止 ──
let lastT = performance.now(), frameReq = 0, idleTimer = 0;
function update(dt) {
  if (player.moving) {
    player.t += dt * PLAYER_SPEED;
    if (player.t >= 1) {
      finishStep(player);
      continuePlayer();
    } else {
      player.rx = player.from.x + (player.to.x - player.from.x) * player.t;
      player.ry = player.from.y + (player.to.y - player.from.y) * player.t;
    }
  } else continuePlayer();
  for (const n of npcs) {
    if (!n.moving) continue;
    n.t += dt * NPC_SPEED;
    if (n.t >= 1) finishStep(n);
    else { n.rx = n.from.x + (n.to.x - n.from.x) * n.t; n.ry = n.from.y + (n.to.y - n.from.y) * n.t; }
  }
  for (const fx of effects) fx.life -= dt / 1.1;
  while (effects.length && effects[0].life <= 0) effects.shift();
  if (marker) { marker.life -= dt / (marker.kind === 'blocked' ? .8 : 1.6); if (marker.life <= 0) marker = null; }
}

function continuePlayer() {
  if (ui.dialogueOpen || ui.panel) { player.path = []; return; }
  if (player.path.length) {
    const next = player.path[0];
    if (freeForPlayer(next.x, next.y)) { player.path.shift(); startStep(player, next); return; }
    // 路被居民擋住：重新尋路一次；仍不行就停下並提示。
    const goal = player.path[player.path.length - 1];
    const p = freeForPlayer(goal.x, goal.y) ? findPath(player, goal, freeForPlayer, MAP_W, MAP_H) : null;
    if (p && p.length) { player.path = p; return; }
    player.path = [];
    const cb = player.onArrive; player.onArrive = null;
    if (cb) cb(); else blockedFeedback(goal.x, goal.y, '路被擋住了，先停在這裡。');
    refresh();
    return;
  }
  if (player.onArrive) { const cb = player.onArrive; player.onArrive = null; cb(); refresh(); return; }
  if (held.length && tryStep(held[held.length - 1])) return;
  if (!player.moving) { schedulePositionSave(); refreshIfChanged(); }
}

let lastTargetKey = '';
function refreshIfChanged() {
  const t = nearbyTarget();
  const k = t ? t.kind + (t.npc ? t.npc.id : t.spot ? t.spot.id : t.item.uid) : '';
  if (k !== lastTargetKey) { lastTargetKey = k; refresh(); }
}

function frame(now) {
  frameReq = 0; idleTimer = 0;
  const dt = Math.min(.1, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  const still = reduceMotion.matches;
  renderer.draw({
    player, npcs: npcs.map(n => ({ ...n, quest: !talkedToday(save, n.id, today()) })),
    spots: availableSpots(save, today()), placed: save.placed, placeHints: placing && placing.hints,
    effects, marker, time: now, still,
    outfit: OUTFITS.find(o => o.id === save.player.outfit) || OUTFITS[0]
  });
  if (document.hidden) return;
  const active = player.moving || player.path.length || held.length || npcs.some(n => n.moving) || effects.length || marker;
  if (active) frameReq = requestAnimationFrame(frame);
  else if (!still) idleTimer = setTimeout(() => { idleTimer = 0; frameReq = requestAnimationFrame(frame); }, 120);
}

function poke() {
  if (frameReq || document.hidden) return;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
  lastT = performance.now();
  frameReq = requestAnimationFrame(frame);
}

// 居民每隔幾秒在家附近走一步；對話中停下來。
setInterval(() => {
  if (document.hidden || reduceMotion.matches) return;
  for (const n of npcs) {
    // 對話中或玩家正走過來時停下，避免走到後居民已經離開。
    if (n.moving || talking === n || approaching === n) continue;
    const to = wanderStep(n, n, freeForNpc);
    if (to) { startStep(n, to); poke(); }
  }
}, 2600);

// ── 輸入 ──
const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const PANELS = { KeyB: 'bag', KeyI: 'bag', KeyT: 'tasks', KeyC: 'build' };

function pressDir(dir) {
  if (ui.dialogueOpen || ui.panel) return;
  hideHint();
  player.path = []; player.onArrive = null; approaching = null;
  if (!held.includes(dir)) held.push(dir);
  poke();
}
function releaseDir(dir) {
  const i = held.indexOf(dir);
  if (i >= 0) held.splice(i, 1);
}

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Escape') {
    if (ui.dialogueOpen) ui.closeDialogue(); else if (ui.panel) ui.closePanel(); else if (placing) stopPlacing();
    return refresh();
  }
  const onButton = e.target instanceof HTMLElement && e.target.closest('button,a');
  if (KEYS[e.code]) { if (!ui.panel) { e.preventDefault(); if (!e.repeat) pressDir(KEYS[e.code]); } return; }
  if (e.code === 'KeyE' || ((e.code === 'Enter' || e.code === 'Space') && !onButton)) { e.preventDefault(); if (!placing) interact(); return refresh(); }
  if (PANELS[e.code] && !ui.dialogueOpen) { togglePanel(PANELS[e.code]); }
});
addEventListener('keyup', e => { if (KEYS[e.code]) releaseDir(KEYS[e.code]); });
addEventListener('blur', () => { held.length = 0; });

canvas.tabIndex = 0;
canvas.addEventListener('pointerdown', e => {
  if (e.button && e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const t = renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top, player);
  onTap(t.x, t.y, t.fx, t.fy);
});

document.getElementById('interact').addEventListener('click', () => { interact(); refresh(); });

document.getElementById('placeCancel').addEventListener('click', stopPlacing);

function togglePanel(name) {
  if (placing) stopPlacing();
  if (ui.panel === name) ui.closePanel();
  else { held.length = 0; player.path = []; player.onArrive = null; ui.openPanel(name, panelCtx()); }
  refresh();
}
document.querySelectorAll('.dock [data-panel]').forEach(b => {
  b.setAttribute('aria-expanded', 'false');
  b.addEventListener('click', () => togglePanel(b.dataset.panel));
});
document.getElementById('drawerClose').addEventListener('click', refresh);

// 螢幕方向鍵（可選）：偏好只存在本機，讀寫失敗就用預設。
const DPAD_KEY = 'probationStudyIsland.v4.dpad';
let dpadOn = false;
try { dpadOn = localStorage.getItem(DPAD_KEY) === '1'; } catch { /* 預設關閉 */ }
const dpadToggle = document.getElementById('dpadToggle');
dpadToggle.setAttribute('aria-pressed', String(dpadOn));
dpadToggle.addEventListener('click', () => {
  dpadOn = !dpadOn;
  dpadToggle.setAttribute('aria-pressed', String(dpadOn));
  try { localStorage.setItem(DPAD_KEY, dpadOn ? '1' : '0'); } catch { /* 只是介面偏好 */ }
  refresh();
});
document.querySelectorAll('#dpad [data-dir]').forEach(b => {
  const dir = b.dataset.dir;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); pressDir(dir); });
  const up = () => { b.classList.remove('on'); releaseDir(dir); };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
});

// 切換分頁回來後：清掉按住的方向、重設計時，從另一分頁更新背包，不讓角色瞬移。
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { held.length = 0; savePosition(); return; }
  try { const fresh = await store.load(); save = { ...fresh, player: save.player }; } catch { /* 保留目前畫面 */ }
  lastT = performance.now();
  refresh();
  if (save.focus && focusRemaining(save) === 0) completeFocus();
});
addEventListener('pagehide', () => { savePosition(); });
store.onExternalChange(async () => {
  try { const fresh = await store.load(); save = { ...fresh, player: save.player }; refresh(); } catch { /* 下次操作會重新讀取 */ }
});

new ResizeObserver(() => {
  renderer.resize(world.clientWidth, world.clientHeight);
  poke();
}).observe(world);
renderer.resize(world.clientWidth, world.clientHeight);
setInterval(() => ui.hud(save), 60000);
document.getElementById('focusChip').addEventListener('click', () => { if (ui.panel !== 'tasks') togglePanel('tasks'); });
refresh();
// 關掉頁面期間專注已經結束：重新開啟時結算一次。
if (save.focus && focusRemaining(save) === 0) completeFocus();

// 給自動化測試讀取目前狀態（不影響遊戲）。
globalThis.__island = { get player() { return { x: player.x, y: player.y, moving: player.moving }; }, get save() { return save; }, get placing() { return placing; }, npcs, renderer, persistent: store.persistent };
