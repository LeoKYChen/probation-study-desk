// Canvas 繪製：靜態地表預先畫在離屏 canvas，人物與物件每幀依 y 排序繪製。全部是原創向量圖形。
import { MAP_W, MAP_H, tileAt, tilesOf, hash2, HOUSE } from './world/map.js';

const C = {
  water: '#7ec8d8', waterDeep: '#6bb8cc', foam: '#dff4f1', sand: '#f2e2b3', sandDot: '#e2cd93',
  grass: '#a9d78c', grassDark: '#93c779', forest: '#8bc17a', path: '#e6d3a3', plaza: '#ecdcb2', plazaLine: '#d9c48f'
};
const LAND = new Set(['sand', 'grass', 'forest', 'path', 'plaza', 'flower', 'house', 'tree', 'rock']);
const GREEN = new Set(['grass', 'forest', 'path', 'plaza', 'flower', 'house', 'tree', 'rock']);
const WOODS = new Set(['forest', 'tree']);
const PAVED = new Set(['path', 'plaza']);

function blobs(g, ts, test, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!test(tileAt(x, y).id)) continue;
    g.moveTo((x + .5 + r) * ts, (y + .5) * ts);
    g.arc((x + .5) * ts, (y + .5) * ts, r * ts, 0, Math.PI * 2);
  }
  g.fill();
}

function drawTerrain(ts) {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * ts; cv.height = MAP_H * ts;
  const g = cv.getContext('2d');
  g.fillStyle = C.water; g.fillRect(0, 0, cv.width, cv.height);
  // 深水色帶，讓外海與近岸有層次。
  g.fillStyle = C.waterDeep;
  g.fillRect(0, 0, cv.width, ts * .45); g.fillRect(0, cv.height - ts * .45, cv.width, ts * .45);
  g.fillRect(0, 0, ts * .45, cv.height); g.fillRect(cv.width - ts * .45, 0, ts * .45, cv.height);
  blobs(g, ts, id => LAND.has(id), .9, C.foam);
  blobs(g, ts, id => LAND.has(id), .76, C.sand);
  blobs(g, ts, id => GREEN.has(id), .72, C.grass);
  blobs(g, ts, id => WOODS.has(id), .7, C.forest);
  // 小路：圓點加上與相鄰鋪面的連接帶，邊緣柔和、不呈方格。
  g.fillStyle = C.path;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!PAVED.has(tileAt(x, y).id)) continue;
    g.beginPath(); g.arc((x + .5) * ts, (y + .5) * ts, ts * .42, 0, Math.PI * 2); g.fill();
    if (PAVED.has(tileAt(x + 1, y).id)) g.fillRect((x + .5) * ts, (y + .08) * ts, ts, ts * .84);
    if (PAVED.has(tileAt(x, y + 1).id)) g.fillRect((x + .08) * ts, (y + .5) * ts, ts * .84, ts);
    // 2×2 鋪面相接處補滿，避免轉角露出草地小點。
    if (PAVED.has(tileAt(x + 1, y).id) && PAVED.has(tileAt(x, y + 1).id) && PAVED.has(tileAt(x + 1, y + 1).id)) g.fillRect((x + .5) * ts, (y + .5) * ts, ts, ts);
  }
  const plaza = tilesOf('plaza');
  if (plaza.length) {
    const x0 = Math.min(...plaza.map(p => p.x)), y0 = Math.min(...plaza.map(p => p.y));
    const x1 = Math.max(...plaza.map(p => p.x)) + 1, y1 = Math.max(...plaza.map(p => p.y)) + 1;
    g.fillStyle = C.plaza;
    roundRect(g, x0 * ts, y0 * ts, (x1 - x0) * ts, (y1 - y0) * ts, ts * .45); g.fill();
    g.strokeStyle = C.plazaLine; g.lineWidth = Math.max(1, ts * .03);
    g.beginPath(); g.arc((x0 + x1) / 2 * ts, (y0 + y1) / 2 * ts, ts * .9, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc((x0 + x1) / 2 * ts, (y0 + y1) / 2 * ts, ts * .35, 0, Math.PI * 2); g.stroke();
  }
  // 細節：草叢、花、沙粒、浪花。位置由座標雜湊決定，每次載入都一樣。
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const id = tileAt(x, y).id, h = hash2(x, y);
    const px = (x + .2 + hash2(x, y, 1) * .6) * ts, py = (y + .25 + hash2(x, y, 2) * .5) * ts;
    if ((id === 'grass' || id === 'forest') && h < .55) {
      g.strokeStyle = id === 'forest' ? '#6fa862' : C.grassDark; g.lineWidth = Math.max(1, ts * .045); g.lineCap = 'round';
      g.beginPath();
      g.moveTo(px - ts * .08, py); g.lineTo(px - ts * .12, py - ts * .12);
      g.moveTo(px, py); g.lineTo(px, py - ts * .16);
      g.moveTo(px + ts * .08, py); g.lineTo(px + ts * .12, py - ts * .12);
      g.stroke();
    } else if (id === 'flower') {
      const cols = ['#f6a5b4', '#ffe28a', '#ffffff', '#c7a6f0'];
      for (let i = 0; i < 6; i++) {
        const fx = (x + .15 + hash2(x, y, 10 + i) * .7) * ts, fy = (y + .15 + hash2(x, y, 20 + i) * .7) * ts;
        g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(fx, fy, ts * .07, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f2b33d'; g.beginPath(); g.arc(fx, fy, ts * .025, 0, Math.PI * 2); g.fill();
      }
    } else if (id === 'sand' && h < .6) {
      g.fillStyle = C.sandDot;
      g.beginPath(); g.arc(px, py, ts * .03, 0, Math.PI * 2); g.arc(px + ts * .2, py + ts * .1, ts * .02, 0, Math.PI * 2); g.fill();
    } else if (id === 'water' && h < .18) {
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, ts * .04); g.lineCap = 'round';
      g.beginPath(); g.arc(px, py + ts * .1, ts * .14, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
  return cv;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function shadow(g, x, y, w) {
  g.fillStyle = 'rgba(40,70,50,.18)';
  g.beginPath(); g.ellipse(x, y, w, w * .38, 0, 0, Math.PI * 2); g.fill();
}

function drawTree(g, x, y, ts) {
  const cx = (x + .5) * ts, by = (y + .9) * ts, v = hash2(x, y, 5);
  shadow(g, cx, by, ts * .42);
  g.fillStyle = '#8a6142'; roundRect(g, cx - ts * .09, by - ts * .55, ts * .18, ts * .55, ts * .05); g.fill();
  const greens = v < .5 ? ['#4f9a5d', '#61ad6a', '#78c07c'] : ['#5a9f58', '#6db766', '#86c97b'];
  const top = by - ts * (.95 + v * .2);
  [[0, .15, .44], [-.2, -.05, .32], [.2, -.05, .32], [0, -.25, .3]].forEach(([dx, dy, r], i) => {
    g.fillStyle = greens[Math.min(i, 2)];
    g.beginPath(); g.arc(cx + dx * ts, top + dy * ts, r * ts, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(cx - ts * .12, top - ts * .22, ts * .1, 0, Math.PI * 2); g.fill();
}

function drawRock(g, x, y, ts) {
  const cx = (x + .5) * ts, by = (y + .8) * ts;
  shadow(g, cx, by, ts * .38);
  g.fillStyle = '#a8aca2'; g.beginPath(); g.ellipse(cx, by - ts * .2, ts * .36, ts * .26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c4c8bd'; g.beginPath(); g.ellipse(cx - ts * .08, by - ts * .28, ts * .16, ts * .1, -.3, 0, Math.PI * 2); g.fill();
}

function drawHouse(g, ts) {
  const x = HOUSE.x * ts, y = HOUSE.y * ts, w = HOUSE.w * ts, h = HOUSE.h * ts;
  shadow(g, x + w / 2, y + h - ts * .05, w * .55);
  g.fillStyle = '#f5ead2'; roundRect(g, x + ts * .15, y + ts * .55, w - ts * .3, h - ts * .6, ts * .12); g.fill();
  g.fillStyle = '#c86b55';
  g.beginPath(); g.moveTo(x - ts * .05, y + ts * .75); g.lineTo(x + w / 2, y - ts * .35); g.lineTo(x + w + ts * .05, y + ts * .75); g.closePath(); g.fill();
  g.fillStyle = '#a95543'; g.fillRect(x + w * .68, y - ts * .15, ts * .28, ts * .5);
  g.fillStyle = '#8a5a3c'; roundRect(g, x + w / 2 - ts * .24, y + h - ts * .78, ts * .48, ts * .74, ts * .2); g.fill();
  g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(x + w / 2 + ts * .12, y + h - ts * .4, ts * .04, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9fd3e6';
  roundRect(g, x + ts * .45, y + ts * .95, ts * .42, ts * .38, ts * .06); g.fill();
  roundRect(g, x + w - ts * .87, y + ts * .95, ts * .42, ts * .38, ts * .06); g.fill();
}

function drawShell(g, s, ts, t, still) {
  const cx = (s.x + .5) * ts, cy = (s.y + .6) * ts;
  shadow(g, cx, cy + ts * .12, ts * .18);
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#f7c6c0';
  g.beginPath(); g.moveTo(0, ts * .1); g.arc(0, ts * .1, ts * .2, Math.PI * 1.1, Math.PI * 1.9); g.closePath(); g.fill();
  g.strokeStyle = '#e39a92'; g.lineWidth = Math.max(1, ts * .025);
  for (const a of [-.55, -.25, .05, .35]) {
    g.beginPath(); g.moveTo(0, ts * .1); g.lineTo(Math.sin(a) * ts * .18, ts * .1 - Math.cos(a) * ts * .18); g.stroke();
  }
  const tw = still ? .8 : (Math.sin(t / 300 + s.x) + 1) / 2;
  g.fillStyle = 'rgba(255,255,255,' + (.35 + tw * .6).toFixed(2) + ')';
  g.beginPath(); g.arc(ts * .13, -ts * .14, ts * (.03 + tw * .03), 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawChestnut(g, n, ts, t, still) {
  const cx = (n.rx + .5) * ts, by = (n.ry + .88) * ts, c = n.colors;
  const bob = still || !n.moving ? 0 : Math.abs(Math.sin(t / 110)) * ts * .04;
  shadow(g, cx, by, ts * .3);
  g.save(); g.translate(cx, by - bob);
  const side = n.facing === 'left' ? -1 : 1;
  // 尾巴
  g.fillStyle = c.body; g.beginPath(); g.ellipse(-side * ts * .22, -ts * .32, ts * .12, ts * .22, -side * .5, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.belly; g.beginPath(); g.ellipse(-side * ts * .27, -ts * .48, ts * .06, ts * .07, 0, 0, Math.PI * 2); g.fill();
  // 身體與頭
  g.fillStyle = c.body; g.beginPath(); g.ellipse(0, -ts * .22, ts * .2, ts * .22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.belly; g.beginPath(); g.ellipse(0, -ts * .18, ts * .11, ts * .14, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.scarf; roundRect(g, -ts * .18, -ts * .43, ts * .36, ts * .08, ts * .04); g.fill();
  g.fillStyle = c.body; g.beginPath(); g.arc(0, -ts * .6, ts * .21, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.fillStyle = c.body; g.beginPath(); g.moveTo(s * ts * .2, -ts * .9); g.lineTo(s * ts * .05, -ts * .74); g.lineTo(s * ts * .2, -ts * .68); g.closePath(); g.fill();
    g.fillStyle = c.ear; g.beginPath(); g.moveTo(s * ts * .18, -ts * .85); g.lineTo(s * ts * .1, -ts * .76); g.lineTo(s * ts * .18, -ts * .72); g.closePath(); g.fill();
  }
  if (n.facing !== 'up') {
    const ox = n.facing === 'left' ? -ts * .05 : n.facing === 'right' ? ts * .05 : 0;
    g.fillStyle = c.belly; g.beginPath(); g.ellipse(ox, -ts * .53, ts * .1, ts * .07, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2a22';
    g.beginPath(); g.arc(ox - ts * .08, -ts * .63, ts * .025, 0, Math.PI * 2); g.arc(ox + ts * .08, -ts * .63, ts * .025, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(ox, -ts * .55, ts * .022, 0, Math.PI * 2); g.fill();
  }
  if (n.quest) {
    const qy = -ts * 1.08 - (still ? 0 : Math.sin(t / 250) * ts * .04);
    g.fillStyle = '#fffaf0'; g.strokeStyle = '#e0a43a'; g.lineWidth = Math.max(1.5, ts * .04);
    g.beginPath(); g.arc(0, qy, ts * .14, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#c47f12'; g.font = '800 ' + Math.round(ts * .2) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', 0, qy + ts * .01);
  }
  g.restore();
}

function drawPlayer(g, p, ts, t, still, outfit) {
  const cx = (p.rx + .5) * ts, by = (p.ry + .9) * ts;
  const step = still || !p.moving ? 0 : Math.sin(t / 90);
  shadow(g, cx, by, ts * .26);
  g.save(); g.translate(cx, by - Math.abs(step) * ts * .035);
  // 腳
  g.fillStyle = '#5a4636';
  g.beginPath(); g.ellipse(-ts * .08, -ts * .03 + step * ts * .02, ts * .06, ts * .04, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(ts * .08, -ts * .03 - step * ts * .02, ts * .06, ts * .04, 0, 0, Math.PI * 2); g.fill();
  // 身體
  g.fillStyle = outfit.shirt; roundRect(g, -ts * .16, -ts * .38, ts * .32, ts * .34, ts * .1); g.fill();
  g.fillStyle = outfit.trim; g.fillRect(-ts * .16, -ts * .12, ts * .32, ts * .05);
  // 頭與頭髮
  g.fillStyle = '#f4d5b8'; g.beginPath(); g.arc(0, -ts * .58, ts * .22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5b3f2e';
  if (p.facing === 'up') {
    g.beginPath(); g.arc(0, -ts * .6, ts * .225, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.arc(0, -ts * .64, ts * .225, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    const ox = p.facing === 'left' ? -ts * .06 : p.facing === 'right' ? ts * .06 : 0;
    g.fillStyle = '#3a2a22';
    if (p.facing === 'down') {
      g.beginPath(); g.arc(-ts * .08, -ts * .55, ts * .028, 0, Math.PI * 2); g.arc(ts * .08, -ts * .55, ts * .028, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(240,140,130,.5)';
      g.beginPath(); g.arc(-ts * .13, -ts * .49, ts * .035, 0, Math.PI * 2); g.arc(ts * .13, -ts * .49, ts * .035, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.arc(ox + (p.facing === 'left' ? -ts * .04 : ts * .04), -ts * .55, ts * .028, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');
  let ts = 48, dpr = 1, vw = 0, vh = 0, terrain = null;
  const trees = tilesOf('tree'), rocks = tilesOf('rock');

  function resize(w, h) {
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    vw = w; vh = h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const next = Math.round(Math.max(36, Math.min(64, Math.min(w, h) / 8.5)));
    if (next !== ts || !terrain) { ts = next; terrain = drawTerrain(Math.round(ts * dpr)); }
  }

  // 鏡頭以玩家為中心，不超出地圖邊界；地圖比畫面小時置中。
  function camera(p) {
    const ww = MAP_W * ts, wh = MAP_H * ts;
    const cx = ww <= vw ? (ww - vw) / 2 : Math.max(0, Math.min(ww - vw, (p.rx + .5) * ts - vw / 2));
    const cy = wh <= vh ? (wh - vh) / 2 : Math.max(0, Math.min(wh - vh, (p.ry + .5) * ts - vh / 2));
    return { x: cx, y: cy };
  }

  function screenToTile(sx, sy, p) {
    const cam = camera(p);
    const fx = (sx + cam.x) / ts, fy = (sy + cam.y) / ts;
    return { x: Math.floor(fx), y: Math.floor(fy), fx, fy };
  }

  function draw(s) {
    const cam = camera(s.player);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.waterDeep; g.fillRect(0, 0, vw, vh);
    g.translate(-cam.x, -cam.y);
    g.drawImage(terrain, 0, 0, MAP_W * ts, MAP_H * ts);
    if (s.marker) {
      const m = s.marker, mx = (m.x + .5) * ts, my = (m.y + .5) * ts;
      g.globalAlpha = Math.max(0, m.life);
      if (m.kind === 'blocked') {
        g.strokeStyle = '#d0574a'; g.lineWidth = ts * .08; g.lineCap = 'round';
        g.beginPath(); g.moveTo(mx - ts * .18, my - ts * .18); g.lineTo(mx + ts * .18, my + ts * .18);
        g.moveTo(mx + ts * .18, my - ts * .18); g.lineTo(mx - ts * .18, my + ts * .18); g.stroke();
      } else {
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = ts * .05;
        g.beginPath(); g.ellipse(mx, my + ts * .2, ts * .24, ts * .11, 0, 0, Math.PI * 2); g.stroke();
      }
      g.globalAlpha = 1;
    }
    const items = [];
    for (const t of trees) items.push({ y: t.y + .9, fn: () => drawTree(g, t.x, t.y, ts) });
    for (const r of rocks) items.push({ y: r.y + .8, fn: () => drawRock(g, r.x, r.y, ts) });
    items.push({ y: HOUSE.y + HOUSE.h, fn: () => drawHouse(g, ts) });
    for (const sp of s.spots) items.push({ y: sp.y + .5, fn: () => drawShell(g, sp, ts, s.time, s.still) });
    for (const n of s.npcs) items.push({ y: n.ry + .88, fn: () => drawChestnut(g, n, ts, s.time, s.still) });
    items.push({ y: s.player.ry + .9, fn: () => drawPlayer(g, s.player, ts, s.time, s.still, s.outfit) });
    items.sort((a, b) => a.y - b.y).forEach(i => i.fn());
    for (const fx of s.effects) {
      const k = 1 - fx.life;
      g.globalAlpha = Math.max(0, Math.min(1, fx.life * 2));
      g.font = '800 ' + Math.round(ts * .34) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = ts * .08; g.strokeStyle = 'rgba(255,255,255,.95)'; g.fillStyle = '#2f6a5b';
      const fy = (fx.y + .1) * ts - k * ts * .7;
      g.strokeText(fx.text, (fx.x + .5) * ts, fy); g.fillText(fx.text, (fx.x + .5) * ts, fy);
      g.globalAlpha = 1;
    }
  }

  function tileToScreen(x, y, p) {
    const cam = camera(p);
    return { x: (x + .5) * ts - cam.x, y: (y + .5) * ts - cam.y };
  }

  return { resize, draw, screenToTile, tileToScreen, get tileSize() { return ts; } };
}
