// 觀護學習島 v4 Demo A 瀏覽器驗收（Playwright + Chromium 模擬手機與桌面）。
// 用法（可加 ISLAND_BROWSER=webkit）：在儲存庫根目錄執行 `python3 -m http.server 8790`，再執行
//   node study-island/v4/tests/e2e.mjs [http://localhost:8790/study-island/v4/] [截圖資料夾]
// 這是模擬器測試，不能取代 iPhone Safari／Android Chrome 實機驗收。
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium, webkit, devices } = createRequire(import.meta.url)('playwright');
// ISLAND_BROWSER=webkit 時改用 WebKit（與 iOS Safari 同引擎，但仍不等於實機）。
const engine = process.env.ISLAND_BROWSER === 'webkit' ? webkit : chromium;

const URL = process.argv[2] || 'http://localhost:8790/study-island/v4/';
const SHOTS = process.argv[3] || '';
const HOUSE = { x: 5, y: 2, w: 3, h: 2 };
const results = [];
async function step(name, fn) {
  try { await fn(); results.push('PASS ' + name); }
  catch (e) { results.push('FAIL ' + name + '\n  ' + (e && e.message)); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = page => page.evaluate(() => ({ p: __island.player, shell: __island.save.inventory.materials.shell, collected: __island.save.collected }));
// 目標在畫面外時（手機只看得到部分地圖），沿最短路徑點畫面內最遠的一格，像真人一樣分段走。
async function tapTile(page, x, y, followNpc = false) {
  for (let hop = 0; hop < 6; hop++) {
    const pt = await page.evaluate(async ([x, y, followNpc]) => {
      if (followNpc) { x = __island.npcs[0].x; y = __island.npcs[0].y; }
      const r = document.getElementById('game').getBoundingClientRect();
      const pl = __island.player, cam = { rx: pl.x, ry: pl.y };
      const onScreen = (tx, ty) => { const s = __island.renderer.tileToScreen(tx, ty, cam); return s.x > 4 && s.y > 4 && s.x < r.width - 4 && s.y < r.height - 4 ? s : null; };
      let s = onScreen(x, y);
      if (s) return { x: r.left + s.x, y: r.top + s.y, final: true };
      const pf = await import('./src/player/pathfinding.js'), map = await import('./src/world/map.js');
      const path = pf.findPath(pl, { x, y }, map.isWalkable, map.MAP_W, map.MAP_H) || [];
      for (let i = path.length - 1; i >= 0; i--) if ((s = onScreen(path[i].x, path[i].y))) return { x: r.left + s.x, y: r.top + s.y, final: false };
      return null;
    }, [x, y, followNpc]);
    if (!pt) throw new Error('tile not reachable on screen');
    await page.touchscreen.tap(pt.x, pt.y);
    if (pt.final) return;
    await waitIdle(page);
  }
}
async function waitIdle(page, timeout = 15000) {
  const end = Date.now() + timeout;
  await sleep(150);
  while (Date.now() < end) {
    const s = await state(page);
    if (!s.p.moving) { await sleep(300); if (!(await state(page)).p.moving) return s; }
    await sleep(100);
  }
  throw new Error('player never stopped');
}
async function npcTile(page) { return page.evaluate(() => ({ x: __island.npcs[0].x, y: __island.npcs[0].y })); }

const browser = await engine.launch();
const errors = [];

// ── 手機（iPhone 尺寸、觸控）──
const phone = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
const page = await phone.newPage();
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForFunction(() => globalThis.__island);

await step('首次進入：角色在出生點、背包有新手家具、存檔可用', async () => {
  const s = await state(page);
  assert.deepEqual([s.p.x, s.p.y], [8, 10]);
  assert.equal(await page.evaluate(() => __island.persistent), true);
  assert.equal(await page.evaluate(() => __island.save.inventory.furniture['starter-stool']), 1);
});
if (SHOTS) await page.screenshot({ path: SHOTS + '/1-start-375.png' });

await step('375px 直式不水平溢出', async () => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
  assert.ok(o.sw <= o.w, JSON.stringify(o));
});

await step('點地自動尋路並繞過小屋', async () => {
  const seen = [];
  await tapTile(page, 6, 1);
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const s = await state(page);
    seen.push(s.p);
    if (!s.p.moving && s.p.x === 6 && s.p.y === 1) break;
    await sleep(60);
  }
  const last = seen[seen.length - 1];
  assert.deepEqual([last.x, last.y], [6, 1]);
  for (const p of seen) assert.ok(!(p.x >= HOUSE.x && p.x < HOUSE.x + HOUSE.w && p.y >= HOUSE.y && p.y < HOUSE.y + HOUSE.h), 'entered house');
});

await step('點房屋：不移動並出現明確提示', async () => {
  await tapTile(page, 6, 2);
  await sleep(200);
  assert.match(await page.textContent('#toast'), /小屋/);
  assert.deepEqual(Object.values((await state(page)).p).slice(0, 2), [6, 1]);
});

await step('點栗子：走到旁邊並開啟對話', async () => {
  const n = await npcTile(page);
  await tapTile(page, n.x, n.y, true);
  try { await page.waitForSelector('#dialogue:not([hidden])', { timeout: 15000 }); }
  catch (e) { throw new Error('no dialogue; npc was ' + JSON.stringify(n) + ' now ' + JSON.stringify(await page.evaluate(() => ({ p: __island.player, n: { x: __island.npcs[0].x, y: __island.npcs[0].y, m: __island.npcs[0].moving }, toast: document.getElementById('toast').textContent })))); }
  assert.match(await page.textContent('#dlgText'), /栗子|嗨/);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/2-dialogue-375.png' });
  for (let i = 0; i < 5 && await page.isVisible('#dialogue'); i++) await page.click('#dlgNext');
  assert.equal(await page.isVisible('#dialogue'), false);
});

await step('撿 3 個海灘貝殼，背包數量增加', async () => {
  for (const [x, y] of [[3, 13], [9, 14], [15, 13]]) {
    await tapTile(page, x, y);
    await waitIdle(page);
    await sleep(300);
  }
  const s = await state(page);
  assert.equal(s.shell, 3);
  assert.equal(await page.textContent('#shellCount'), '3');
});

await step('背包可開啟、顯示貝殼與家具、可關閉', async () => {
  await page.click('.dock [data-panel=bag]');
  await page.waitForSelector('#drawer:not([hidden])');
  const t = await page.textContent('#drawerBody');
  assert.match(t, /貝殼 ×3/); assert.match(t, /新手木凳 ×1/);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/3-bag-375.png' });
  await page.click('#drawerClose');
  assert.equal(await page.isVisible('#drawer'), false);
});

await step('重新整理：貝殼與位置都還在', async () => {
  const before = await waitIdle(page);
  await sleep(900); // 位置在停下 0.5 秒後保存
  await page.reload();
  await page.waitForFunction(() => globalThis.__island);
  const s = await state(page);
  assert.equal(s.shell, 3);
  assert.deepEqual([s.p.x, s.p.y], [before.p.x, before.p.y]);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#game').length), 1);
});

await step('島上有 4 位居民', async () => {
  assert.deepEqual(await page.evaluate(() => __island.npcs.map(n => n.name)), ['栗子', '阿棕', '小白', '墨墨']);
});

await step('樹林採集木材 ×2、葉子 ×1', async () => {
  for (const [x, y] of [[12, 3], [17, 4], [14, 5]]) {
    await tapTile(page, x, y);
    await waitIdle(page);
    await sleep(300);
  }
  const m = await page.evaluate(() => __island.save.inventory.materials);
  assert.deepEqual([m.wood, m.leaf], [2, 1]);
});

await step('工坊：材料不足的按鈕停用；製作木椅後材料正確扣除', async () => {
  await page.click('.dock [data-panel=build]');
  await page.waitForSelector('#drawer:not([hidden])');
  assert.equal(await page.isDisabled('[data-act=craft][data-id=flowerbed]'), true);  // 葉子只有 1 片
  assert.equal(await page.isDisabled('[data-act=craft][data-id=lantern]'), false); // 貝殼 3、木材 2
  await page.click('[data-act=craft][data-id=wood-chair]');
  await page.waitForFunction(() => __island.save.inventory.furniture['wood-chair'] === 1);
  const m = await page.evaluate(() => __island.save.inventory.materials);
  assert.deepEqual([m.wood, m.leaf], [0, 0]);
  assert.equal(await page.isDisabled('[data-act=craft][data-id=wood-chair]'), true);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/6-workshop-375.png' });
});

// 擺放模式：在畫面內挑一格有白點（可擺放）的地面。
async function tapPlaceHint(page) {
  const pt = await page.evaluate(() => {
    const r = document.getElementById('game').getBoundingClientRect(), pl = __island.player;
    for (const h of __island.placing.hints) {
      const s = __island.renderer.tileToScreen(h.x, h.y, { rx: pl.x, ry: pl.y });
      if (s.x > 30 && s.y > 30 && s.x < r.width - 30 && s.y < r.height - 120) return { x: r.left + s.x, y: r.top + s.y, tile: h };
    }
    return null;
  });
  assert.ok(pt, 'no on-screen placeable tile');
  await page.touchscreen.tap(pt.x, pt.y);
  return pt.tile;
}

let placedTile;
await step('擺放新手木凳：小路不能放；空地可以放，背包減少', async () => {
  await page.click('[data-act=place][data-id=starter-stool]');
  await page.waitForSelector('#placeBar:not([hidden])');
  assert.equal(await page.isVisible('#drawer'), false);
  placedTile = await tapPlaceHint(page);
  await page.waitForFunction(() => __island.save.placed.length === 1);
  assert.equal(await page.isVisible('#placeBar'), false);
  assert.equal(await page.evaluate(() => __island.save.inventory.furniture['starter-stool'] || 0), 0);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/7-placed-375.png' });
  await page.click('.dock [data-panel=build]');
  await page.click('[data-act=place][data-id=wood-chair]');
  const pathPt = await page.evaluate(() => {
    const r = document.getElementById('game').getBoundingClientRect(), pl = __island.player;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) {
      if (!['p'].includes(['~~~~~~~~~~~~~~~~~~~~', '~~ggggggggggTgTTT~~~', '~ggggHHHgggggfTfTT~~', '~gFggHHHggggfffTff~~', '~gggggpggggTffTfff~~', '~ggFgppppppfffffTf~~', '~ggggpzzzzpffTffff~~', '~ggggpzzzzpfffTfff~~', '~gRggpzzzzpgffffTf~~', '~ggggppppppgggfffg~~', '~sggggpgggggggggggs~', '~ssgggpggFgggggggss~', '~sssggpgggggggggsss~', '~~ssssssssssssssss~~', '~~~sssssssssssss~~~~', '~~~~~~~~~~~~~~~~~~~~'][y][x])) continue;
      const s = __island.renderer.tileToScreen(x, y, { rx: pl.x, ry: pl.y });
      if (s.x > 10 && s.y > 10 && s.x < r.width - 10 && s.y < r.height - 120) return { x: r.left + s.x, y: r.top + s.y };
    }
    return null;
  });
  if (pathPt) {
    await page.touchscreen.tap(pathPt.x, pathPt.y);
    await sleep(150);
    assert.match(await page.textContent('#toast'), /小路/);
    assert.equal(await page.evaluate(() => __island.save.placed.length), 1);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#placeBar'), false);
});

await step('重新整理：家具位置與背包不變', async () => {
  await page.reload();
  await page.waitForFunction(() => globalThis.__island);
  const s = await page.evaluate(() => ({ placed: __island.save.placed, f: __island.save.inventory.furniture }));
  assert.equal(s.placed.length, 1);
  assert.deepEqual([s.placed[0].x, s.placed[0].y, s.placed[0].id], [placedTile.x, placedTile.y, 'starter-stool']);
  assert.equal(s.f['wood-chair'], 1);
});

await step('收回家具：回到背包，連點不會多出一件', async () => {
  await page.click('.dock [data-panel=build]');
  await page.waitForSelector('[data-act=pickup]');
  await page.evaluate(() => { const b = document.querySelector('[data-act=pickup]'); for (let i = 0; i < 5; i++) b.click(); });
  await page.waitForFunction(() => __island.save.placed.length === 0);
  await sleep(300);
  assert.equal(await page.evaluate(() => __island.save.inventory.furniture['starter-stool']), 1);
  await page.click('#drawerClose');
});

await step('委託：撿完 2 個貝殼可領一次葉子，連點不重複', async () => {
  const before = await page.evaluate(() => __island.save.inventory.materials.leaf);
  await page.click('.dock [data-panel=tasks]');
  await page.waitForSelector('[data-act=claim][data-id=shells2]');
  await page.evaluate(() => { const b = document.querySelector('[data-act=claim][data-id=shells2]'); for (let i = 0; i < 5; i++) b.click(); });
  await page.waitForFunction(b => __island.save.inventory.materials.leaf === b + 1, before);
  await sleep(300);
  assert.equal(await page.evaluate(() => __island.save.inventory.materials.leaf), before + 1);
  assert.match(await page.textContent('#drawerBody'), /已領取/);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/8-tasks-375.png' });
  await page.click('#drawerClose');
});

await step('工坊：同時送出 5 次製作，材料只夠 1 次就只做 1 件', async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  const r = await p.evaluate(async () => {
    const m = await import('./src/persistence.js'), c = await import('./src/collectibles.js');
    const s = await m.openStore(), d = c.localDate();
    for (const id of ['forest-wood-1', 'forest-wood-2', 'forest-leaf-1']) await s.mutate({ type: 'collect', spotId: id, date: d });
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => s.mutate({ type: 'craft', recipeId: 'wood-chair', date: d })));
    const final = await s.load();
    return { ok: rs.filter(x => x.result.ok).length, chairs: final.inventory.furniture['wood-chair'], wood: final.inventory.materials.wood };
  });
  assert.deepEqual(r, { ok: 1, chairs: 1, wood: 0 });
  await ctx.close();
});

await step('同一採集點：兩個分頁同時撿只成功一次', async () => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage(), b = await ctx.newPage();
  await a.goto(URL); await b.goto(URL);
  await a.waitForFunction(() => globalThis.__island); await b.waitForFunction(() => globalThis.__island);
  const go = p => p.evaluate(async () => {
    const m = await import('./src/persistence.js');
    const c = await import('./src/collectibles.js');
    const s = await m.openStore();
    const rs = await Promise.all([1, 2, 3].map(() => s.mutate({ type: 'collect', spotId: 'beach-shell-2', date: c.localDate() })));
    return rs.filter(r => r.result.ok).length;
  });
  const [x, y] = await Promise.all([go(a), go(b)]);
  assert.equal(x + y, 1, 'ok count ' + (x + y));
  const total = await a.evaluate(async () => (await (await import('./src/persistence.js')).openStore().then(s => s.load())).inventory.materials.shell);
  assert.equal(total, 1);
  await ctx.close();
});

await step('連點互動鍵不會重複入袋', async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
  const p = await ctx.newPage();
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  await tapTile(p, 9, 13);            // 站在貝殼旁邊（不直接踩上去，避免自動撿起）
  await waitIdle(p);
  await p.waitForSelector('#interact:not([hidden])');
  await Promise.all([1, 2, 3, 4, 5].map(() => p.evaluate(() => document.getElementById('interact').click())));
  await sleep(500);
  assert.equal((await state(p)).shell, 1);
  await ctx.close();
});

await step('螢幕方向鍵可開啟並移動角色，不遮住背包按鈕', async () => {
  await page.click('#dpadToggle');
  await page.waitForSelector('#dpad:not([hidden])');
  const dock = await page.locator('.dock').boundingBox();
  const dpad = await page.locator('#dpad').boundingBox();
  assert.ok(dpad.y + dpad.height <= dock.y, 'dpad overlaps dock');
  const before = await state(page);
  let after = before;
  for (const dir of ['up', 'down', 'left', 'right']) {   // 前方可能是樹，換個方向試
    const btn = await page.locator('#dpad [data-dir=' + dir + ']').boundingBox();
    await page.mouse.move(btn.x + 20, btn.y + 20); await page.mouse.down(); await sleep(450); await page.mouse.up();
    await waitIdle(page);
    after = await state(page);
    if (after.p.x !== before.p.x || after.p.y !== before.p.y) break;
  }
  assert.notDeepEqual([after.p.x, after.p.y], [before.p.x, before.p.y]);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/4-dpad-375.png' });
});

await step('不讀寫 v1 小島或其他學習資料', async () => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(keys.filter(k => k !== 'probationStudyIsland.v4.dpad'), []);
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
  assert.deepEqual(dbs, ['probation-study-island-v4']);
});

// ── 階段 C：專注計時（Playwright 假時鐘快轉，不用真的等 5 分鐘）與自行回報 ──
await step('專注 5 分鐘：開始後倒數、重新整理接續、時間未到不給、時間到只給一次', async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
  await ctx.clock.install({ time: new Date('2026-10-31T10:00:00') });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island, null, { polling: 100 });
  await p.click('.dock [data-panel=tasks]');
  await p.click('[data-act=focus][data-id="5"]');
  await p.waitForFunction(() => __island.save.focus, null, { polling: 100 });
  assert.equal(await p.isVisible('#focusChip'), true);
  assert.equal(await p.textContent('#focusTimer'), '05:00');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/9-focus-375.png' });
  await p.clock.fastForward('02:00');
  await p.reload(); await p.waitForFunction(() => globalThis.__island, null, { polling: 100 });
  assert.ok(await p.evaluate(() => __island.save.focus && __island.save.focus.minutes === 5), '重新整理後仍在專注');
  await p.clock.fastForward('02:30');
  await p.clock.runFor(1500);
  const mid = await p.evaluate(() => ({ shell: __island.save.inventory.materials.shell, chip: document.getElementById('focusChip').textContent }));
  assert.equal(mid.shell, 0, '時間未到不給');
  assert.match(mid.chip, /00:[23]\d/);
  await p.clock.fastForward('00:40');
  await p.clock.runFor(2000);
  await p.waitForFunction(() => !__island.save.focus, null, { polling: 100 });
  await p.clock.runFor(5000);
  const m = await p.evaluate(() => __island.save.inventory.materials);
  assert.deepEqual([m.shell, m.leaf], [1, 1]);
  assert.equal(await p.isVisible('#focusChip'), false);
  await ctx.close();
});

await step('專注：取消不給獎勵；學習任務需二次確認、每天一次、標示自行回報', async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
  const p = await ctx.newPage();
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  await p.click('.dock [data-panel=tasks]');
  await p.click('[data-act=focus][data-id="25"]');
  await p.waitForSelector('[data-act=focusCancel]');
  await p.click('[data-act=focusCancel]');
  await p.waitForFunction(() => !__island.save.focus);
  assert.equal(await p.evaluate(() => __island.save.inventory.materials.shell), 0);
  assert.match(await p.textContent('#drawerBody'), /自行回報/);
  await p.click('[data-act=study][data-id=essay]');
  assert.equal(await p.evaluate(() => __island.save.inventory.materials.shell), 0, '第一次按只是詢問');
  await p.click('[data-act=studyConfirm][data-id=essay]');
  await p.waitForFunction(() => __island.save.inventory.materials.shell === 2);
  assert.match(await p.textContent('#drawerBody'), /已回報/);
  if (SHOTS) await p.screenshot({ path: SHOTS + '/10-study-375.png' });
  const r = await p.evaluate(async () => {
    const m = await import('./src/persistence.js'), c = await import('./src/collectibles.js');
    const s = await m.openStore();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => s.mutate({ type: 'studyReport', taskId: 'recall', date: c.localDate() })));
    return rs.filter(x => x.result.ok).length;
  });
  assert.equal(r, 1);
  await ctx.close();
});

// ── 階段 D：v3 舊島遷移、備份匯出／匯入、與既有學習頁面互不干擾 ──
const V3_URL = new globalThis.URL('../', URL).href;
const v3Data = {
  version: 1, coins: 137, xp: 400, islandName: '測試舊島', days: ['2026-10-01', '2026-10-02', '2026-10-03'], claims: {},
  owned: { flower: 2, lamp: 1, tree: 0, bench: 0, tent: 0, garden: 0 },
  plots: Object.assign(Array(36).fill(''), { 0: 'bench', 7: 'lamp', 35: 'flower' }), history: ['2026-10-01　完成申論'],
  focusEnd: 0, focusMinutes: 0, hearts: { fox: 6, bear: 2, bunny: 0, owl: 12 }, weeklyClaimed: []
};
const openData = async p => {
  await p.click('.dock [data-panel=bag]');
  await p.click('[data-act=openData]');
  await p.waitForSelector('#drawerTitle:has-text("備份與舊島花園")');
};

await step('同網址 v3 存檔：預覽→取消不變→確定轉入；v1 原資料逐字不變、v3 頁面照常', async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(V3_URL);
  await p.evaluate(d => localStorage.setItem('probationStudyIsland.v1', JSON.stringify(d)), v3Data);
  await p.reload();
  assert.match(await p.textContent('body'), /測試舊島/, 'v3 頁面讀得到這份存檔');
  const original = await p.evaluate(() => localStorage.getItem('probationStudyIsland.v1'));
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  await openData(p);
  await p.click('[data-act=previewLocal]');
  const prev = await p.textContent('.preview');
  assert.match(prev, /測試舊島/); assert.match(prev, /137/); assert.match(prev, /三日萌芽/);
  await p.click('[data-act=cancelImport]');
  assert.equal(await p.evaluate(() => __island.save.legacy), null, '取消不改資料');
  await p.click('[data-act=previewLocal]');
  await p.click('[data-act=confirmImport]');
  await p.waitForFunction(() => __island.save.legacy);
  assert.equal(await p.locator('.garden .cell').count(), 36);
  const body = await p.textContent('#drawerBody');
  assert.match(body, /舊島貝殼 137/); assert.match(body, /小燈籠 ×1/);
  if (SHOTS) await p.screenshot({ path: SHOTS + '/11-legacy-375.png' });
  const f = await p.evaluate(() => [1, 2, 3, 4].map(i => (__island.save.npc[['chestnut', 'brownie', 'snowy', 'inky'][i - 1]] || {}).friendship || 0));
  assert.deepEqual(f, [6, 2, 0, 10]);
  assert.equal(await p.evaluate(() => localStorage.getItem('probationStudyIsland.v1')), original, 'v1 逐字不變');
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  assert.equal(await p.evaluate(() => __island.save.legacy.garden[7]), 'lamp', '重新整理後仍在');
  await p.goto(V3_URL);
  assert.match(await p.textContent('body'), /測試舊島/, 'v3 頁面不受影響');
  await ctx.close();
});

await step('不同網址：用 v3 匯出的 JSON 轉入；壞檔案被拒絕且不改資料', async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  await openData(p);
  assert.match(await p.textContent('#drawerBody'), /匯出小島 JSON/, '找不到本機 v3 時說明怎麼做');
  await p.setInputFiles('[data-act=importFile]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await sleep(200);
  assert.match(await p.textContent('#toast'), /匯入失敗/);
  assert.equal(await p.locator('.preview').count(), 0);
  await p.setInputFiles('[data-act=importFile]', { name: 'study-island.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v3Data)) });
  await p.waitForSelector('.preview');
  await p.click('[data-act=confirmImport]');
  await p.waitForFunction(() => __island.save.legacy && __island.save.legacy.source === 'file');
  await ctx.close();
});

await step('v4 備份：匯出→在新瀏覽器匯入預覽、取消不變、確定後內容相同', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  await p.evaluate(async () => {
    const m = await import('./src/persistence.js'), c = await import('./src/collectibles.js');
    const s = await m.openStore(), d = c.localDate();
    for (const id of ['beach-shell-1', 'forest-wood-1', 'forest-leaf-2']) await s.mutate({ type: 'collect', spotId: id, date: d });
    await s.mutate({ type: 'place', itemId: 'starter-stool', x: 9, y: 11, actors: [] });
  });
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  await openData(p);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=exportBackup]')]);
  assert.match(dl.suggestedFilename(), /^study-island-v4-\d{4}-\d{2}-\d{2}\.json$/);
  const file = { name: 'backup.json', mimeType: 'application/json', buffer: await readFile(await dl.path()) };
  const expected = await p.evaluate(() => ({ inv: __island.save.inventory, placed: __island.save.placed }));
  await ctx.close();

  const ctx2 = await browser.newContext();
  const q = await ctx2.newPage();
  await q.goto(URL); await q.waitForFunction(() => globalThis.__island);
  await openData(q);
  await q.setInputFiles('[data-act=importFile]', file);
  await q.waitForSelector('.preview');
  assert.match(await q.textContent('.preview'), /取代/);
  await q.click('[data-act=cancelImport]');
  assert.equal(await q.evaluate(() => __island.save.placed.length), 0, '取消不改資料');
  await q.setInputFiles('[data-act=importFile]', file);
  await q.click('[data-act=confirmImport]');
  await q.waitForFunction(() => __island.save.placed.length === 1);
  await q.reload(); await q.waitForFunction(() => globalThis.__island);
  const got = await q.evaluate(() => ({ inv: __island.save.inventory, placed: __island.save.placed }));
  assert.deepEqual(got, expected);
  await ctx2.close();
});

await step('既有學習頁面：玩小島前後，考古題／備考書桌／主動回憶的瀏覽器資料完全相同', async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const pages = ['../../v2.5/', '../../study-desk/', '../../active-recall/'].map(x => new globalThis.URL(x, URL).href);
  const snap = async () => p.evaluate(async () => {
    const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    const dbs = (await indexedDB.databases()).map(d => d.name).filter(n => n !== 'probation-study-island-v4').sort();
    return { ls, dbs };
  });
  // 模擬使用者在學習頁面留下的資料（含一筆作答），再去玩小島。
  await p.goto(pages[0]);
  await p.evaluate(() => localStorage.setItem('e2e-answer-marker', '我的申論答案（測試）'));
  for (const u of pages) await p.goto(u);
  // 學習頁面每次開啟都可能更新自己的狀態，所以只比對「小島操作前後」這段期間的變化。
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  const before = await snap();
  await p.evaluate(async () => {
    const m = await import('./src/persistence.js'), c = await import('./src/collectibles.js');
    const s = await m.openStore(), d = c.localDate();
    await s.mutate({ type: 'collect', spotId: 'beach-shell-1', date: d });
    await s.mutate({ type: 'studyReport', taskId: 'essay', date: d });
  });
  await openData(p);
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  const after = await snap();
  const changed = [...new Set([...Object.keys(before.ls), ...Object.keys(after.ls)])].filter(k => before.ls[k] !== after.ls[k]);
  if (changed.length) console.log('DIFF', JSON.stringify(changed.map(k => [k, String(before.ls[k]).slice(0, 120), String(after.ls[k]).slice(0, 120)])));
  assert.deepEqual(after, before);
  assert.equal(after.ls['e2e-answer-marker'], '我的申論答案（測試）');
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(String(e)));
  for (const u of pages) await p.goto(u);
  assert.equal(await p.evaluate(() => localStorage.getItem('e2e-answer-marker')), '我的申論答案（測試）');
  assert.deepEqual(pageErrors, [], '學習頁面照常開啟');
  await ctx.close();
});

// ── 修仙主題 X1：切換外觀，進度不變 ──
await step('修仙主題：切換後名稱與畫面改變、進度完全不變、重新整理保留；可切回島嶼', async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  await p.evaluate(async () => {
    const m = await import('./src/persistence.js'), c = await import('./src/collectibles.js');
    const s = await m.openStore(), d = c.localDate();
    for (const id of ['beach-shell-1', 'forest-wood-1']) await s.mutate({ type: 'collect', spotId: id, date: d });
    await s.mutate({ type: 'place', itemId: 'starter-stool', x: 9, y: 11, actors: [] });
  });
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  const progress = () => p.evaluate(() => JSON.stringify({ inv: __island.save.inventory, placed: __island.save.placed, npc: __island.save.npc, ledger: __island.save.rewardLedger }));
  const before = await progress();
  await p.click('.dock [data-panel=bag]');
  await p.click('[data-act=theme][data-id=xianxia]');
  await p.waitForFunction(() => __island.save.theme === 'xianxia');
  assert.equal(await progress(), before, '切換主題不改進度');
  assert.equal(await p.textContent('#islandName'), '青嵐山');
  assert.match(await p.textContent('.hud .shells'), /💎/);
  assert.deepEqual(await p.$$eval('.dock button span', els => els.map(e => e.textContent)), ['乾坤袋', '師門', '丹房']);
  assert.match(await p.textContent('#drawerBody'), /靈石 ×1/);
  assert.ok(!(await p.textContent('#drawerBody')).includes('貝殼'));
  assert.match(await p.textContent('#drawerBody'), /舊日庭園/);
  await p.click('#drawerClose');
  await p.click('.dock [data-panel=build]');
  assert.match(await p.textContent('#drawerTitle'), /丹房與佈置/);
  assert.match(await p.textContent('#drawerBody'), /山上的器物[\s\S]*入門蒲團/);
  assert.ok(!/居民|工坊|家具|貝殼|背包/.test(await p.textContent('#drawerBody')), '丹房面板沒有島嶼用語');
  await p.click('#drawerClose');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/12-xianxia-375.png' });
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  assert.equal(await p.evaluate(() => __island.save.theme), 'xianxia', '重新整理保留主題');
  assert.equal(await p.textContent('#islandName'), '青嵐山');
  await tapTile(p, (await npcTile(p)).x, (await npcTile(p)).y, true);
  await p.waitForSelector('#dialogue:not([hidden])', { timeout: 15000 });
  assert.match(await p.textContent('#dlgName'), /師姐秋棠/);
  if (SHOTS) await p.screenshot({ path: SHOTS + '/13-xianxia-dialogue-375.png' });
  await p.click('#dlgNext'); await p.click('#dlgNext'); await p.click('#dlgNext');
  await p.click('.dock [data-panel=tasks]');
  assert.match(await p.textContent('#drawerTitle'), /師門任務/);
  assert.match(await p.textContent('#drawerBody'), /打坐 25 分鐘/);
  assert.ok(!/居民|工坊|家具|貝殼/.test(await p.textContent('#drawerBody')), '師門面板沒有島嶼用語');
  assert.match(await p.textContent('#drawerBody'), /自行回報/);
  await p.click('#drawerClose');
  await p.click('.dock [data-panel=bag]');
  await p.click('[data-act=theme][data-id=island]');
  await p.waitForFunction(() => __island.save.theme === 'island');
  assert.equal(await p.textContent('#islandName'), '小樹灣');
  assert.match(await p.textContent('#islandName'), /小樹灣/);
  await ctx.close();
});

// ── 修仙主題 X2：修為、煉丹、突破 ──
await step('修為：修仙主題顯示境界；回報得修為；修為足夠→煉築基丹→突破一定成功並保留；島嶼主題不顯示', async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 740 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(URL); await p.waitForFunction(() => globalThis.__island);
  assert.equal(await p.isVisible('#realmChip'), false, '島嶼主題不顯示境界');
  // 準備一份「修為 880、材料足夠」的存檔（以整份取代的方式寫入，等同匯入備份）。
  await p.evaluate(async () => {
    const m = await import('./src/persistence.js'), st = await import('./src/state.js');
    const s = st.createSave();
    s.theme = 'xianxia'; s.cultivation.xp = 880;
    Object.assign(s.inventory.materials, { shell: 3, wood: 2, leaf: 2, fruit: 1 });
    await (await m.openStore()).replace(s);
  });
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  assert.equal(await p.textContent('#realmChip'), '練氣九層');
  await p.click('.dock [data-panel=tasks]');
  assert.match(await p.textContent('#drawerBody'), /距離築基還差 20/);
  assert.match(await p.textContent('#drawerBody'), /不代表考試能力/);
  await p.click('[data-act=study][data-id=essay]');
  await p.click('[data-act=studyConfirm][data-id=essay]');
  await p.waitForFunction(() => __island.save.cultivation.xp === 900);
  assert.match(await p.textContent('#toast'), /修為 \+20/);
  assert.match(await p.textContent('#drawerBody'), /到「丹房」煉一顆築基丹/);
  await p.click('#drawerClose');
  await p.click('.dock [data-panel=build]');
  await p.click('[data-act=craftPill][data-id=pill-foundation]');
  await p.waitForFunction(() => (__island.save.inventory.pills || {})['pill-foundation'] === 1);
  await p.click('#drawerClose');
  await p.click('.dock [data-panel=tasks]');
  await p.click('[data-act=breakthrough]');
  await p.waitForSelector('#ceremony:not([hidden])');
  assert.equal(await p.textContent('#ceremonyTitle'), '築基');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/15-breakthrough-375.png' });
  await p.click('#ceremonyOk');
  assert.equal(await p.isVisible('#ceremony'), false);
  assert.equal(await p.textContent('#realmChip'), '築基初期');
  await p.reload(); await p.waitForFunction(() => globalThis.__island);
  const c = await p.evaluate(() => __island.save.cultivation);
  assert.deepEqual([c.realm, c.xp], [1, 900], '突破後保留，修為不減');
  assert.equal(await p.textContent('#realmChip'), '築基初期');
  await p.click('.dock [data-panel=tasks]');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/16-cultivation-375.png' });
  await p.click('#drawerClose');
  await p.click('.dock [data-panel=bag]');
  await p.click('[data-act=theme][data-id=island]');
  await p.waitForFunction(() => __island.save.theme === 'island');
  assert.equal(await p.isVisible('#realmChip'), false);
  await p.click('#drawerClose');
  await p.click('.dock [data-panel=tasks]');
  assert.ok(!(await p.textContent('#drawerBody')).includes('修為'), '島嶼主題的任務面板沒有修為');
  await ctx.close();
});

// ── 桌面（鍵盤）──
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await desk.newPage();
dp.on('pageerror', e => errors.push(String(e)));
await dp.goto(URL); await dp.waitForFunction(() => globalThis.__island);
if (SHOTS) await dp.screenshot({ path: SHOTS + '/5-desktop.png' });
await step('桌面：WASD 移動、撞牆停下、E 與栗子對話、Esc 關閉', async () => {
  await dp.focus('#game');
  await dp.keyboard.down('KeyA'); await sleep(260); await dp.keyboard.up('KeyA');
  const s1 = await waitIdle(dp);
  assert.ok(s1.p.x < 8, 'moved left');
  const n = await npcTile(dp);
  const pt = await dp.evaluate(([x, y]) => { const r = document.getElementById('game').getBoundingClientRect(); const s = __island.renderer.tileToScreen(x, y, { rx: __island.player.x, ry: __island.player.y }); return { x: r.left + s.x, y: r.top + s.y }; }, [n.x, n.y]);
  await dp.mouse.click(pt.x, pt.y);
  await dp.waitForSelector('#dialogue:not([hidden])', { timeout: 15000 });
  await dp.keyboard.press('Escape');
  assert.equal(await dp.isVisible('#dialogue'), false);
  await dp.keyboard.press('KeyE');
  await dp.waitForSelector('#dialogue:not([hidden])', { timeout: 3000 });
  await dp.keyboard.press('Escape');
  await dp.keyboard.press('KeyB');
  await dp.waitForSelector('#drawer:not([hidden])');
  await dp.keyboard.press('Escape');
  assert.equal(await dp.isVisible('#drawer'), false);
});

if (SHOTS) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const q = await c.newPage();
  await q.goto(URL); await q.waitForFunction(() => globalThis.__island);
  await q.evaluate(async () => { const m = await import('./src/persistence.js'); await (await m.openStore()).mutate({ type: 'setTheme', theme: 'xianxia' }); });
  await q.reload(); await q.waitForFunction(() => globalThis.__island);
  await q.screenshot({ path: SHOTS + '/14-xianxia-desktop.png' });
  await c.close();
}

await step('沒有 JavaScript 錯誤', async () => { assert.deepEqual(errors, []); });

await browser.close();
console.log(results.join('\n'));
if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
