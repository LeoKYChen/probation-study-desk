// 觀護學習島 v4 Demo A：地圖、尋路、採集去重、存檔正規化（純 Node，不需瀏覽器）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_W, MAP_H, rows, isWalkable, tileAt, SPAWN, HOUSE } from '../src/world/map.js';
import { findPath, pathToNeighbor } from '../src/player/pathfinding.js';
import { SPOTS, availableSpots, localDate } from '../src/collectibles.js';
import { NPCS, wanderStep, chestnutLines, linesFor } from '../src/npc/dialogue.js';
import { canPlace } from '../src/world/placement.js';
import { QUESTS, questStatus } from '../src/quests.js';
import { createSave, normalizeSave, applyAction, shellsCollectedToday, SCHEMA } from '../src/state.js';

const walk = (x, y) => isWalkable(x, y);

test('地圖是 20×16，四周是海，包含小屋、廣場、樹林、沙灘', () => {
  assert.equal(MAP_W, 20); assert.equal(MAP_H, 16);
  const r = rows();
  assert.equal(r.length, MAP_H);
  r.forEach((row, i) => assert.equal(row.length, MAP_W, 'row ' + i));
  for (let x = 0; x < MAP_W; x++) { assert.equal(tileAt(x, 0).id, 'water'); assert.equal(tileAt(x, MAP_H - 1).id, 'water'); }
  const ids = new Set(r.join('').split('').map((c, i) => tileAt(i % MAP_W, Math.floor(i / MAP_W)).id));
  for (const id of ['house', 'plaza', 'forest', 'tree', 'sand']) assert.ok(ids.has(id), id);
  assert.ok(walk(SPAWN.x, SPAWN.y));
  assert.ok(walk(HOUSE.door.x, HOUSE.door.y));
});

test('房屋、樹、海不可走；超出邊界不可走', () => {
  assert.equal(walk(HOUSE.x, HOUSE.y), false);
  assert.equal(walk(-1, 3), false);
  assert.equal(walk(0, 0), false);
  assert.equal(walk(12, 1), false); // 樹
});

test('A* 繞過房屋，每一步都相鄰且可走', () => {
  const start = { x: 4, y: 3 }, goal = { x: 8, y: 3 };
  const p = findPath(start, goal, walk, MAP_W, MAP_H);
  assert.ok(p && p.length > 4, '必須繞路');
  let prev = start;
  for (const s of p) {
    assert.equal(Math.abs(s.x - prev.x) + Math.abs(s.y - prev.y), 1);
    assert.ok(walk(s.x, s.y));
    assert.ok(!(s.x >= HOUSE.x && s.x < HOUSE.x + HOUSE.w && s.y >= HOUSE.y && s.y < HOUSE.y + HOUSE.h));
    prev = s;
  }
  assert.deepEqual(p[p.length - 1], goal);
});

test('A* 目標是障礙物時回傳 null；原地回傳空陣列', () => {
  assert.equal(findPath(SPAWN, { x: 0, y: 0 }, walk, MAP_W, MAP_H), null);
  assert.deepEqual(findPath(SPAWN, SPAWN, walk, MAP_W, MAP_H), []);
});

test('pathToNeighbor 走到居民旁邊而不是居民身上', () => {
  const npc = NPCS[0].home;
  const r = pathToNeighbor(SPAWN, npc, (x, y) => walk(x, y) && !(x === npc.x && y === npc.y), MAP_W, MAP_H);
  assert.ok(r);
  assert.equal(Math.abs(r.stand.x - npc.x) + Math.abs(r.stand.y - npc.y), 1);
});

test('採集點：貝殼在沙灘、木材／葉子／果實在樹林，全部走得到且不在居民家', () => {
  const by = m => SPOTS.filter(s => s.material === m);
  assert.equal(by('shell').length, 3);
  for (const m of ['wood', 'leaf', 'fruit']) assert.ok(by(m).length >= 2, m);
  assert.equal(new Set(SPOTS.map(s => s.x + ',' + s.y)).size, SPOTS.length, '位置不重複');
  for (const s of SPOTS) {
    assert.equal(tileAt(s.x, s.y).id, s.material === 'shell' ? 'sand' : 'forest', s.id);
    assert.ok(findPath(SPAWN, s, walk, MAP_W, MAP_H), s.id);
    assert.ok(!NPCS.some(n => n.home.x === s.x && n.home.y === s.y), s.id);
  }
});

test('4 位居民：家可走、互不重疊、走得到、不在出生點', () => {
  assert.deepEqual(NPCS.map(n => n.name), ['栗子', '阿棕', '小白', '墨墨']);
  assert.equal(new Set(NPCS.map(n => n.home.x + ',' + n.home.y)).size, 4);
  for (const n of NPCS) {
    assert.ok(walk(n.home.x, n.home.y), n.id);
    assert.ok(pathToNeighbor(SPAWN, n.home, walk, MAP_W, MAP_H), n.id);
    assert.ok(Math.abs(n.home.x - SPAWN.x) + Math.abs(n.home.y - SPAWN.y) > n.range, n.id);
  }
});

test('同一個採集點同一天只給一次；隔天重新出現', () => {
  const s = createSave();
  const d1 = '2026-10-30', d2 = '2026-10-31';
  const a = applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: d1 });
  assert.equal(a.ok, true); assert.equal(a.total, 1);
  const b = applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: d1 });
  assert.equal(b.ok, false); assert.equal(b.reason, 'already'); assert.equal(b.changed, false);
  assert.equal(s.inventory.materials.shell, 1);
  const shells = d => availableSpots(s, d).filter(x => x.material === 'shell').length;
  assert.equal(shells(d1), 2);
  assert.equal(shellsCollectedToday(s, d1), 1);
  assert.equal(shells(d2), 3);
  applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: d2 });
  assert.equal(s.inventory.materials.shell, 2);
  assert.deepEqual(Object.keys(s.collected), [d2], '舊日期紀錄被清掉');
});

test('未知採集點不給獎', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'collect', spotId: 'nope', date: '2026-10-30' }).ok, false);
  assert.equal(s.inventory.materials.shell, 0);
});

test('位置只記錄可走的安全格', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'move', x: HOUSE.x, y: HOUSE.y, facing: 'up' }).ok, false);
  assert.equal(applyAction(s, { type: 'move', x: 3, y: 13, facing: 'left' }).changed, true);
  assert.deepEqual([s.player.x, s.player.y, s.player.facing], [3, 13, 'left']);
});

test('存檔正規化：壞資料回預設、不安全位置回出生點、保留新手家具', () => {
  assert.equal(normalizeSave(null).schema, SCHEMA);
  assert.equal(normalizeSave({ schema: 'other' }).inventory.materials.shell, 0);
  const n = normalizeSave({ schema: SCHEMA, player: { x: 0, y: 0, facing: 'x', outfit: 'zzz' }, inventory: { materials: { shell: 4, wood: -2 } } });
  assert.deepEqual([n.player.x, n.player.y, n.player.facing, n.player.outfit], [SPAWN.x, SPAWN.y, 'down', 'leaf']);
  assert.equal(n.inventory.materials.shell, 4);
  assert.equal(n.inventory.materials.wood, 0);
  assert.equal(createSave().inventory.furniture['starter-stool'], 1);
});

test('對話：第一次打招呼才算改變，同一天再聊不重複', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'talk', npcId: 'chestnut', date: '2026-10-30' }).talkedToday, false);
  const again = applyAction(s, { type: 'talk', npcId: 'chestnut', date: '2026-10-30' });
  assert.equal(again.talkedToday, true); assert.equal(again.changed, false);
  assert.ok(chestnutLines({ shellsToday: 3, shellsTotalToday: 3, talkedToday: true }).some(l => l.includes('都被你找到')));
});

test('居民只在家附近走動', () => {
  for (const n of NPCS) {
  let pos = { ...n.home }, i = 0;
  const rand = () => ((i++ * 0.37) % 1);
  for (let k = 0; k < 200; k++) {
    const to = wanderStep(n, pos, walk, rand);
    if (to) pos = to;
    assert.ok(Math.abs(pos.x - n.home.x) + Math.abs(pos.y - n.home.y) <= n.range);
    assert.ok(walk(pos.x, pos.y));
  }
  }
});

test('localDate 使用本機日期', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

const D = '2026-10-31';
const give = (s, mats) => Object.assign(s.inventory.materials, mats);

test('親密度：每天第一次聊天 +1，同一天不重複；台詞依親密度變化', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'talk', npcId: 'brownie', date: D }).friendship, 1);
  assert.equal(applyAction(s, { type: 'talk', npcId: 'brownie', date: D }).friendship, 1);
  assert.equal(applyAction(s, { type: 'talk', npcId: 'brownie', date: '2026-11-01' }).friendship, 2);
  assert.equal(applyAction(s, { type: 'talk', npcId: 'nobody', date: D }).ok, false);
  const n = NPCS[1];
  assert.notEqual(linesFor(n, { friendship: 0 })[0], linesFor(n, { friendship: 7 })[0]);
});

test('工坊：3 個配方；材料足夠才製作並正確扣除，缺料回報差多少', () => {
  const s = createSave();
  const miss = applyAction(s, { type: 'craft', recipeId: 'wood-chair', date: D });
  assert.equal(miss.ok, false); assert.equal(miss.reason, 'missing');
  assert.deepEqual(miss.missing.map(m => m.id).sort(), ['leaf', 'wood']);
  give(s, { wood: 3, leaf: 3, shell: 3 });
  assert.equal(applyAction(s, { type: 'craft', recipeId: 'wood-chair', date: D }).ok, true);
  assert.deepEqual([s.inventory.materials.wood, s.inventory.materials.leaf], [1, 2]);
  assert.equal(applyAction(s, { type: 'craft', recipeId: 'flowerbed', date: D }).ok, true);
  assert.deepEqual([s.inventory.materials.wood, s.inventory.materials.leaf], [0, 0]);
  assert.equal(applyAction(s, { type: 'craft', recipeId: 'lantern', date: D }).reason, 'missing');
  assert.equal(s.inventory.materials.shell, 3, '失敗不扣料');
  assert.deepEqual([s.inventory.furniture['wood-chair'], s.inventory.furniture.flowerbed], [1, 1]);
  assert.equal(s.daily.crafted, 2);
});

test('擺放：只能放在空地；不能放小路、採集點、居民家、有人的格子或已有家具', () => {
  const s = createSave();
  const ok = canPlace(s, 9, 11);
  assert.equal(ok.ok, true);
  assert.equal(canPlace(s, 6, 4).reason, 'path');
  assert.equal(canPlace(s, 3, 13).reason, 'spot');
  assert.equal(canPlace(s, NPCS[0].home.x, NPCS[0].home.y).reason, 'home');
  assert.equal(canPlace(s, 9, 11, [{ x: 9, y: 11 }]).reason, 'actor');
  assert.equal(canPlace(s, HOUSE.x, HOUSE.y).reason, 'terrain');
  const r = applyAction(s, { type: 'place', itemId: 'starter-stool', x: 9, y: 11 });
  assert.equal(r.ok, true);
  assert.equal(s.inventory.furniture['starter-stool'], undefined, '背包少一件');
  assert.equal(canPlace(s, 9, 11).reason, 'furniture');
  assert.equal(applyAction(s, { type: 'place', itemId: 'starter-stool', x: 10, y: 11 }).reason, 'none-left');
  assert.equal(applyAction(s, { type: 'move', x: 9, y: 11, facing: 'up' }).ok, false, '家具上不是安全位置');
});

test('擺放：不能把任何地方封死', () => {
  const s = createSave();
  s.inventory.furniture['wood-chair'] = 1;
  assert.equal(applyAction(s, { type: 'place', itemId: 'wood-chair', x: 3, y: 1 }).ok, true);
  // (2,1) 只剩 (2,2) 一個出口，再擺就會被困住。
  assert.equal(canPlace(s, 2, 2).reason, 'blocks');
});

test('收回：家具回到背包、位置清空；重複收回不會多出家具', () => {
  const s = createSave();
  const { uid } = applyAction(s, { type: 'place', itemId: 'starter-stool', x: 9, y: 11 });
  assert.equal(applyAction(s, { type: 'pickup', uid }).ok, true);
  assert.equal(applyAction(s, { type: 'pickup', uid }).ok, false);
  assert.equal(s.inventory.furniture['starter-stool'], 1);
  assert.deepEqual(s.placed, []);
});

test('委託：完成才能領，每項每天只領一次，隔天重置', () => {
  const s = createSave();
  const q = QUESTS.find(x => x.id === 'shells2');
  assert.equal(applyAction(s, { type: 'claimQuest', questId: 'shells2', date: D }).reason, 'not-done');
  applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: D });
  applyAction(s, { type: 'collect', spotId: 'beach-shell-2', date: D });
  assert.equal(questStatus(s, q, D).done, true);
  assert.equal(applyAction(s, { type: 'claimQuest', questId: 'shells2', date: D }).ok, true);
  assert.equal(s.inventory.materials.leaf, 1);
  assert.equal(applyAction(s, { type: 'claimQuest', questId: 'shells2', date: D }).reason, 'already');
  assert.equal(s.inventory.materials.leaf, 1);
  assert.equal(questStatus(s, q, '2026-11-01').claimed, false);
  give(s, { wood: 2, leaf: 1 });
  applyAction(s, { type: 'craft', recipeId: 'wood-chair', date: D });
  assert.equal(applyAction(s, { type: 'claimQuest', questId: 'craft1', date: D }).ok, true);
  applyAction(s, { type: 'talk', npcId: 'chestnut', date: D });
  assert.equal(applyAction(s, { type: 'claimQuest', questId: 'talk2', date: D }).reason, 'not-done');
  applyAction(s, { type: 'talk', npcId: 'snowy', date: D });
  assert.equal(applyAction(s, { type: 'claimQuest', questId: 'talk2', date: D }).ok, true);
});

test('存檔正規化：壞掉的家具位置收回背包，不靜默丟棄；Demo A 舊存檔可讀', () => {
  const n = normalizeSave({
    schema: SCHEMA, placed: [
      { uid: 1, id: 'wood-chair', x: 9, y: 11 },
      { uid: 2, id: 'lantern', x: 0, y: 0 },
      { uid: 1, id: 'flowerbed', x: 10, y: 11 },
      { uid: 3, id: 'unknown', x: 10, y: 12 }
    ]
  });
  assert.deepEqual(n.placed, [{ uid: 1, id: 'wood-chair', x: 9, y: 11 }]);
  assert.equal(n.inventory.furniture.lantern, 1);
  assert.equal(n.inventory.furniture.flowerbed, 1);
  assert.ok(n.nextUid >= 2);
  const demoA = normalizeSave({ schema: SCHEMA, player: { x: 3, y: 13, facing: 'left', outfit: 'sky' }, inventory: { materials: { shell: 3 }, furniture: { 'starter-stool': 1 } }, collected: { [D]: ['beach-shell-1'] }, npc: { chestnut: { lastTalkDate: D } } });
  assert.deepEqual([demoA.player.x, demoA.inventory.materials.shell, demoA.placed.length], [3, 3, 0]);
});

// ── 階段 C：專注計時與學習任務 ──
import { FOCUS_OPTIONS, STUDY_TASKS, focusRemaining } from '../src/learning.js';
const at = (iso) => new Date(iso);

test('專注：時間未到不給；到了只結算一次；取消不給也不扣', () => {
  const s = createSave();
  const t0 = at('2026-10-31T10:00:00');
  assert.equal(applyAction(s, { type: 'focusStart', minutes: 7 }, t0).reason, 'unknown-focus');
  assert.equal(applyAction(s, { type: 'focusStart', minutes: 5 }, t0).ok, true);
  assert.equal(applyAction(s, { type: 'focusStart', minutes: 25 }, t0).reason, 'running');
  assert.equal(focusRemaining(s, t0.getTime() + 60000), 4 * 60000);
  assert.equal(applyAction(s, { type: 'focusComplete', date: D }, at('2026-10-31T10:04:59')).reason, 'not-yet');
  assert.equal(s.inventory.materials.shell, 0);
  const r = applyAction(s, { type: 'focusComplete', date: D }, at('2026-10-31T10:05:00'));
  assert.equal(r.ok, true); assert.equal(r.capped, false);
  assert.deepEqual([s.inventory.materials.shell, s.inventory.materials.leaf], [1, 1]);
  assert.equal(s.npc.brownie.friendship, 1);
  assert.equal(applyAction(s, { type: 'focusComplete', date: D }, at('2026-10-31T10:06:00')).reason, 'none');
  assert.equal(s.inventory.materials.shell, 1);
  applyAction(s, { type: 'focusStart', minutes: 25 }, at('2026-10-31T11:00:00'));
  assert.equal(applyAction(s, { type: 'focusCancel' }).ok, true);
  assert.equal(s.focus, null);
  assert.equal(s.inventory.materials.shell, 1, '取消不扣也不給');
});

test('專注：每日上限後仍可專注但不給獎勵；隔天重置', () => {
  const s = createSave();
  const cap = FOCUS_OPTIONS.find(o => o.minutes === 5).dailyCap;
  let t = at('2026-10-31T08:00:00').getTime();
  const run = date => {
    applyAction(s, { type: 'focusStart', minutes: 5 }, new Date(t));
    t += 5 * 60000;
    return applyAction(s, { type: 'focusComplete', date }, new Date(t));
  };
  for (let i = 0; i < cap; i++) assert.equal(run(D).capped, false);
  const shells = s.inventory.materials.shell;
  const over = run(D);
  assert.equal(over.ok, true); assert.equal(over.capped, true);
  assert.equal(s.inventory.materials.shell, shells);
  assert.equal(run('2026-11-01').capped, false);
});

test('專注：跨日開始的 25 分鐘依完成日計算；重新整理（正規化）後仍保留', () => {
  const s = createSave();
  applyAction(s, { type: 'focusStart', minutes: 25 }, at('2026-10-31T23:50:00'));
  const n = normalizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(n.focus.minutes, 25);
  assert.equal(applyAction(n, { type: 'focusComplete', date: '2026-11-01' }, at('2026-11-01T00:15:00')).ok, true);
  assert.equal(n.daily.date, '2026-11-01');
  assert.equal(normalizeSave({ schema: SCHEMA, focus: { minutes: 9, startedAt: 'x' } }).focus, null);
});

test('學習任務：自行回報每項每天一次，給材料與居民親密度', () => {
  const s = createSave();
  assert.equal(STUDY_TASKS.length, 3);
  const r = applyAction(s, { type: 'studyReport', taskId: 'essay', date: D });
  assert.equal(r.ok, true); assert.equal(r.selfReported, true);
  assert.deepEqual([s.inventory.materials.shell, s.inventory.materials.wood], [2, 1]);
  assert.equal(s.npc.chestnut.friendship, 1);
  assert.equal(applyAction(s, { type: 'studyReport', taskId: 'essay', date: D }).reason, 'already');
  assert.equal(s.inventory.materials.shell, 2);
  assert.equal(applyAction(s, { type: 'studyReport', taskId: 'essay', date: '2026-11-01' }).ok, true);
  assert.equal(applyAction(s, { type: 'studyReport', taskId: 'nope', date: D }).ok, false);
  assert.ok(Object.keys(s.rewardLedger).every(k => !k.startsWith('study:' + D)), '舊日期的回報紀錄已清掉');
});

// ── 階段 D：v3 舊島遷移與 v4 備份 ──
import { legacyFromV1, applyLegacy, parseImport, makeBackup, legacySummary, BACKUP_FORMAT } from '../src/migration.js';

const v3 = () => ({
  version: 1, coins: 137, xp: 400, islandName: '我的小島',
  days: ['2026-10-01', '2026-10-02', '2026-10-03', 'bad'],
  claims: {}, owned: { flower: 2, lamp: 1, mystery: 3 },
  plots: Object.assign(Array(36).fill(''), { 0: 'bench', 2: 'tent', 7: 'lamp', 35: 'flower', 10: 'spaceship' }),
  history: ['2026-10-01　完成申論'], focusEnd: 0, focusMinutes: 0,
  hearts: { fox: 6, bear: 2, bunny: 0, owl: 12 }, weeklyClaimed: ['2026-09-28']
});

test('v3 → 舊島花園：位置、數量、貝殼、親密度、成就都保留；放不下的進倉庫不丟棄', () => {
  const raw = v3(), before = JSON.stringify(raw);
  const l = legacyFromV1(raw, { source: 'local', now: at('2026-10-31T09:00:00') });
  assert.equal(JSON.stringify(raw), before, 'v1 原資料不被修改');
  assert.deepEqual([l.garden[0], l.garden[7], l.garden[35]], ['bench', 'lamp', 'flower']);
  assert.equal(l.garden[2], '', '固定景物格不放家具');
  assert.equal(l.garden[10], '', '不認得的 ID 不放花園');
  assert.deepEqual(l.storage, { tent: 1, spaceship: 1, flower: 2, lamp: 1, mystery: 3 });
  const total = s => Object.values(s).reduce((a, b) => a + b, 0);
  assert.equal(l.garden.filter(Boolean).length + total(l.storage), 4 + 1 + 6, '全部 11 件都在');
  assert.equal(l.shells, 137);
  assert.deepEqual(l.hearts, { fox: 6, bear: 2, bunny: 0, owl: 12 });
  assert.equal(l.days.length, 3);
  assert.ok(l.badges.includes('🌸 三日萌芽') && l.badges.includes('✨ 星光居民') && l.badges.includes('🏡 村莊 Lv.3'));
  assert.equal(legacySummary(l).conflicts, 2);
});

test('套用舊島：只新增 legacy、親密度取較高者（上限 10）、不重複轉入、不動 v4 材料', () => {
  const s = createSave();
  s.npc.brownie = { friendship: 5 };
  const r = applyAction(s, { type: 'migrateV1', legacy: legacyFromV1(v3()) });
  assert.equal(r.ok, true);
  assert.deepEqual(['chestnut', 'brownie', 'snowy', 'inky'].map(id => s.npc[id].friendship), [6, 5, 0, 10]);
  assert.equal(s.inventory.materials.shell, 0, '舊島貝殼保留在紀錄中，不加進材料');
  assert.equal(applyAction(s, { type: 'migrateV1', legacy: legacyFromV1(v3()) }).reason, 'already');
  const n = normalizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(n.legacy.garden[0], 'bench');
  assert.equal(n.legacy.storage.mystery, 3);
});

test('v3 格式錯誤會被拒絕，且不產生任何資料', () => {
  assert.throws(() => legacyFromV1({ version: 2, plots: [] }), /不是 v3/);
  assert.throws(() => parseImport('{oops'), /不是有效的 JSON/);
  assert.throws(() => parseImport(JSON.stringify({ hello: 1 })), /認不得/);
  assert.throws(() => parseImport('x'.repeat(1024 * 1024 + 1)), /過大/);
  assert.throws(() => parseImport(JSON.stringify({ format: BACKUP_FORMAT, version: 9, save: {} })), /較新版本/);
});

test('v4 備份：匯出後再匯入內容相同；v3 檔案會被辨識為舊島', () => {
  const s = createSave();
  give(s, { wood: 3, leaf: 2, shell: 4 });
  applyAction(s, { type: 'place', itemId: 'starter-stool', x: 9, y: 11 });
  applyAction(s, { type: 'studyReport', taskId: 'essay', date: D });
  const back = parseImport(JSON.stringify(makeBackup(s)));
  assert.equal(back.kind, 'v4');
  assert.deepEqual(back.save.inventory, s.inventory);
  assert.deepEqual(back.save.placed, s.placed);
  assert.deepEqual(back.save.rewardLedger, s.rewardLedger);
  assert.ok(!JSON.stringify(makeBackup(s)).includes('probationStudyIsland.v1'));
  assert.equal(parseImport(JSON.stringify(v3())).kind, 'v1');
});

// ── 修仙主題 X1：主題切換只改外觀 ──
import { THEMES, setTheme } from '../src/theme.js';
import { MATERIALS, FURNITURE } from '../src/inventory.js';
import { TERRAIN } from '../src/world/map.js';

test('兩種主題都有完整的名稱：材料、器物、地形、同門、學習任務、介面文字', () => {
  const keys = Object.keys(THEMES.island.words);
  for (const t of Object.values(THEMES)) {
    for (const k of keys) assert.ok(typeof t.words[k] === 'string' && t.words[k], t.id + ' words.' + k);
    for (const m of MATERIALS) assert.ok(t.materials[m.id].name && t.materials[m.id].icon, t.id + ' ' + m.id);
    for (const f of FURNITURE) assert.ok(t.furniture[f.id].name, t.id + ' ' + f.id);
    for (const ter of Object.values(TERRAIN)) assert.ok(t.terrain[ter.id], t.id + ' ' + ter.id);
    for (const n of NPCS) assert.ok(t.npcs[n.id].name, t.id + ' ' + n.id);
    for (const s of STUDY_TASKS) assert.ok(t.study[s.id], t.id + ' ' + s.id);
  }
});

test('修仙主題的文字不殘留島嶼用語', () => {
  const x = THEMES.xianxia;
  const text = JSON.stringify([x.words, x.materials, x.furniture, x.terrain, x.npcs, x.study]) +
    NPCS.map(n => x.lines[n.id].hint({ shellsToday: 1, shellsTotal: 3 }) + x.lines[n.id].rest).join('');
  for (const word of ['貝殼', '木材', '葉子', '果實', '工坊', '小島', '居民', '沙灘', '小屋', '背包']) assert.ok(!text.includes(word), word);
});

test('切換主題：只改 theme 欄位，背包、家具、親密度、帳本、專注都不變；不認得的主題被拒絕', () => {
  const s = createSave();
  give(s, { shell: 3, wood: 2 });
  applyAction(s, { type: 'place', itemId: 'starter-stool', x: 9, y: 11 });
  applyAction(s, { type: 'studyReport', taskId: 'essay', date: D });
  applyAction(s, { type: 'focusStart', minutes: 5 }, at('2026-10-31T10:00:00'));
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.theme; delete c.updatedAt; return c; };
  const before = strip(s);
  assert.equal(applyAction(s, { type: 'setTheme', theme: 'xianxia' }).ok, true);
  assert.equal(s.theme, 'xianxia');
  assert.deepEqual(strip(s), before);
  assert.equal(applyAction(s, { type: 'setTheme', theme: 'space' }).reason, 'unknown-theme');
  assert.equal(normalizeSave(JSON.parse(JSON.stringify(s))).theme, 'xianxia');
  assert.equal(normalizeSave({ schema: SCHEMA, theme: 'bad' }).theme, 'island');
  assert.equal(createSave().theme, 'island', '預設島嶼');
});

test('修仙主題的同門台詞與名稱；切回島嶼恢復原本台詞', () => {
  try {
    setTheme('xianxia');
    const lines = linesFor(NPCS[0], { friendship: 0, shellsToday: 0, shellsTotal: 3 });
    assert.match(lines[0], /秋棠/); assert.match(lines[1], /靈石/);
    setTheme('island');
    assert.match(linesFor(NPCS[0], { friendship: 0, shellsToday: 0, shellsTotal: 3 })[0], /栗子/);
  } finally { setTheme('island'); }
});
