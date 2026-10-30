// 觀護學習島 v4 Demo A 瀏覽器驗收（Playwright + Chromium 模擬手機與桌面）。
// 用法：在儲存庫根目錄執行 `python3 -m http.server 8790`，再執行
//   node study-island/v4/tests/e2e.mjs [http://localhost:8790/study-island/v4/] [截圖資料夾]
// 這是模擬器測試，不能取代 iPhone Safari／Android Chrome 實機驗收。
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

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

const browser = await chromium.launch();
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
  const btn = await page.locator('#dpad [data-dir=up]').boundingBox();
  await page.mouse.move(btn.x + 20, btn.y + 20); await page.mouse.down(); await sleep(450); await page.mouse.up();
  await waitIdle(page);
  const after = await state(page);
  assert.notDeepEqual([after.p.x, after.p.y], [before.p.x, before.p.y]);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/4-dpad-375.png' });
});

await step('不讀寫 v1 小島或其他學習資料', async () => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(keys.filter(k => k !== 'probationStudyIsland.v4.dpad'), []);
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
  assert.deepEqual(dbs, ['probation-study-island-v4']);
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

await step('沒有 JavaScript 錯誤', async () => { assert.deepEqual(errors, []); });

await browser.close();
console.log(results.join('\n'));
if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
