// Canvas 繪製：靜態地表預先畫在離屏 canvas，人物與物件每幀依 y 排序繪製。全部是原創向量圖形。
import { MAP_W, MAP_H, tileAt, tilesOf, hash2, HOUSE } from './world/map.js';
import { theme } from './theme.js';
import { drawBamboo, drawStone, drawCaveHouse, drawXSpot, drawXFurniture, drawRobed, playerLook, drawCloud } from './render-xianxia.js';

// 配色依外觀主題（theme.js）。
const pal = () => theme().palette;
const LAND = new Set(['sand', 'grass', 'forest', 'path', 'plaza', 'flower', 'house', 'tree', 'rock']);
const GREEN = new Set(['grass', 'forest', 'path', 'plaza', 'flower', 'house', 'tree', 'rock']);
const WOODS = new Set(['forest', 'tree']);
const PAVED = new Set(['path', 'plaza']);

// 以圓形聯集畫出柔和邊緣；在相鄰格子之間補圓，讓海岸與林緣更平滑，不出現一顆顆的圓弧。
function blobs(g, ts, test, r, color, dy = 0) {
  g.fillStyle = color;
  g.beginPath();
  const dot = (cx, cy) => { g.moveTo((cx + r) * ts, (cy + dy) * ts); g.arc(cx * ts, (cy + dy) * ts, r * ts, 0, Math.PI * 2); };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!test(tileAt(x, y).id)) continue;
    dot(x + .5, y + .5);
    if (test(tileAt(x + 1, y).id)) dot(x + 1, y + .5);
    if (test(tileAt(x, y + 1).id)) dot(x + .5, y + 1);
    if (test(tileAt(x + 1, y + 1).id) && test(tileAt(x + 1, y).id) && test(tileAt(x, y + 1).id)) dot(x + 1, y + 1);
  }
  g.fill();
}

function drawTerrain(ts) {
  const C = pal(), xian = theme().id === 'xianxia';
  const cv = document.createElement('canvas');
  cv.width = MAP_W * ts; cv.height = MAP_H * ts;
  const g = cv.getContext('2d');
  // 海／雲海：中間淺、外圍深的漸層。
  const grad = g.createRadialGradient(cv.width / 2, cv.height / 2, ts * 3, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .62);
  grad.addColorStop(0, C.water); grad.addColorStop(1, C.waterDeep);
  g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
  // 淺灘、浪花、濕沙、沙灘。
  blobs(g, ts, id => LAND.has(id), 1.25, C.shallow);
  blobs(g, ts, id => LAND.has(id), .92, C.foam);
  blobs(g, ts, id => LAND.has(id), .82, C.wetSand);
  blobs(g, ts, id => LAND.has(id), .74, C.sand);
  // 草地像微微隆起的台地：先畫下緣陰影，再畫草面。
  blobs(g, ts, id => GREEN.has(id), .7, C.grassEdge, .09);
  blobs(g, ts, id => GREEN.has(id), .7, C.grass);
  // 草地斑駁的光影，讓大片綠色不單調。
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!GREEN.has(tileAt(x, y).id)) continue;
    const h = hash2(x, y, 31);
    if (h > .7) continue;
    g.fillStyle = h < .35 ? C.grassLight : C.grassShade;
    g.beginPath(); g.ellipse((x + .2 + hash2(x, y, 32) * .6) * ts, (y + .2 + hash2(x, y, 33) * .6) * ts, ts * (.55 + h * .3), ts * (.32 + h * .2), h * 3, 0, Math.PI * 2); g.fill();
  }
  blobs(g, ts, id => WOODS.has(id), .68, C.forest);
  // 小路：先畫稍寬的邊，再畫路面，連接處補滿。
  for (const [color, wide] of [[C.pathEdge, .05], [C.path, 0]]) {
    g.fillStyle = color;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!PAVED.has(tileAt(x, y).id)) continue;
      g.beginPath(); g.arc((x + .5) * ts, (y + .5) * ts, ts * (.42 + wide), 0, Math.PI * 2); g.fill();
      if (PAVED.has(tileAt(x + 1, y).id)) g.fillRect((x + .5) * ts, (y + .08 - wide) * ts, ts, ts * (.84 + wide * 2));
      if (PAVED.has(tileAt(x, y + 1).id)) g.fillRect((x + .08 - wide) * ts, (y + .5) * ts, ts * (.84 + wide * 2), ts);
      if (PAVED.has(tileAt(x + 1, y).id) && PAVED.has(tileAt(x, y + 1).id) && PAVED.has(tileAt(x + 1, y + 1).id)) g.fillRect((x + .5) * ts, (y + .5) * ts, ts, ts);
    }
  }
  // 小路上的小石子。
  for (const p of tilesOf('path')) {
    g.fillStyle = C.pathEdge;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.ellipse((p.x + .2 + hash2(p.x, p.y, 40 + i) * .6) * ts, (p.y + .2 + hash2(p.x, p.y, 50 + i) * .6) * ts, ts * .035, ts * .025, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // 廣場／演武坪：石板拼貼、外框與中央圓紋。
  const plaza = tilesOf('plaza');
  if (plaza.length) {
    const x0 = Math.min(...plaza.map(p => p.x)), y0 = Math.min(...plaza.map(p => p.y));
    const x1 = Math.max(...plaza.map(p => p.x)) + 1, y1 = Math.max(...plaza.map(p => p.y)) + 1;
    const px0 = x0 * ts + ts * .08, py0 = y0 * ts + ts * .08, pw = (x1 - x0) * ts - ts * .16, ph = (y1 - y0) * ts - ts * .16;
    g.fillStyle = C.plazaEdge; roundRect(g, px0 - ts * .06, py0 - ts * .02, pw + ts * .12, ph + ts * .14, ts * .4); g.fill();
    g.save(); roundRect(g, px0, py0, pw, ph, ts * .34); g.clip();
    g.fillStyle = C.plazaLine; g.fillRect(px0, py0, pw, ph);
    const slab = ts * .5;
    for (let r = 0; r * slab < ph; r++) for (let c = -1; c * slab < pw; c++) {
      g.fillStyle = C.stone[Math.floor(hash2(c, r, 61) * C.stone.length)];
      const ox = r % 2 ? slab / 2 : 0;
      roundRect(g, px0 + c * slab + ox + ts * .02, py0 + r * slab + ts * .02, slab - ts * .04, slab - ts * .04, ts * .05); g.fill();
    }
    g.restore();
    const cx = (x0 + x1) / 2 * ts, cy = (y0 + y1) / 2 * ts;
    g.fillStyle = C.plaza; g.beginPath(); g.arc(cx, cy, ts * .95, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.plazaEdge; g.lineWidth = Math.max(1, ts * .035);
    g.beginPath(); g.arc(cx, cy, ts * .95, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, ts * .6, 0, Math.PI * 2); g.stroke();
    // 中央圓紋：島嶼是八方位星形，修仙是八道放射紋。
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r1 = xian ? ts * .6 : (i % 2 ? ts * .3 : ts * .55), r2 = xian ? ts * .95 : ts * .12;
      g.moveTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    g.stroke();
    g.fillStyle = C.plazaEdge; g.beginPath(); g.arc(cx, cy, ts * .1, 0, Math.PI * 2); g.fill();
  }
  // 細節：草叢、花、沙粒、浪花或雲。位置由座標雜湊決定，每次載入都一樣。
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const id = tileAt(x, y).id, h = hash2(x, y);
    const px = (x + .2 + hash2(x, y, 1) * .6) * ts, py = (y + .25 + hash2(x, y, 2) * .5) * ts;
    if ((id === 'grass' || id === 'forest') && h < .6) {
      g.strokeStyle = id === 'forest' ? C.forestTuft : C.grassDark; g.lineWidth = Math.max(1, ts * .04); g.lineCap = 'round';
      g.beginPath();
      g.moveTo(px - ts * .07, py); g.quadraticCurveTo(px - ts * .1, py - ts * .06, px - ts * .13, py - ts * .12);
      g.moveTo(px, py); g.lineTo(px, py - ts * .16);
      g.moveTo(px + ts * .07, py); g.quadraticCurveTo(px + ts * .1, py - ts * .06, px + ts * .13, py - ts * .12);
      g.stroke();
    } else if (id === 'flower') {
      const cols = xian ? ['#f4c6d2', '#fff4c7', '#ffffff', '#cfe3f5'] : ['#f6a5b4', '#ffe28a', '#ffffff', '#c7a6f0'];
      for (let i = 0; i < 7; i++) {
        const fx = (x + .15 + hash2(x, y, 10 + i) * .7) * ts, fy = (y + .15 + hash2(x, y, 20 + i) * .7) * ts;
        g.fillStyle = C.flowerLeaf; g.beginPath(); g.ellipse(fx + ts * .05, fy + ts * .05, ts * .05, ts * .025, .6, 0, Math.PI * 2); g.fill();
        g.fillStyle = cols[i % cols.length];
        for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; g.beginPath(); g.arc(fx + Math.cos(a) * ts * .04, fy + Math.sin(a) * ts * .04, ts * .035, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#f2b33d'; g.beginPath(); g.arc(fx, fy, ts * .025, 0, Math.PI * 2); g.fill();
      }
    } else if (id === 'sand' && h < .6) {
      g.fillStyle = C.sandDot;
      g.beginPath(); g.arc(px, py, ts * .03, 0, Math.PI * 2); g.arc(px + ts * .2, py + ts * .1, ts * .02, 0, Math.PI * 2); g.fill();
    } else if (id === 'water' && h < .2 && xian) {
      drawCloud(g, px, py, ts);
    } else if (id === 'water' && h < .2) {
      g.strokeStyle = C.wave; g.lineWidth = Math.max(1, ts * .035); g.lineCap = 'round';
      g.beginPath(); g.arc(px, py + ts * .1, ts * .14, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.beginPath(); g.arc(px + ts * .22, py + ts * .16, ts * .09, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    }
  }
  return cv;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// 柔和的橢圓陰影（中心深、邊緣淡）。
function shadow(g, x, y, w) {
  g.save(); g.translate(x, y); g.scale(1, .38);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, w);
  rg.addColorStop(0, 'rgba(30,60,45,.28)'); rg.addColorStop(1, 'rgba(30,60,45,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, w, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawTree(g, x, y, ts) {
  const cx = (x + .5) * ts, by = (y + .9) * ts, v = hash2(x, y, 5);
  shadow(g, cx + ts * .08, by, ts * .5);
  // 樹幹：亮面與暗面。
  g.fillStyle = '#7b543a'; roundRect(g, cx - ts * .09, by - ts * .58, ts * .18, ts * .58, ts * .05); g.fill();
  g.fillStyle = '#9a6d4b'; roundRect(g, cx - ts * .09, by - ts * .58, ts * .08, ts * .58, ts * .04); g.fill();
  g.fillStyle = '#6a4630'; g.beginPath(); g.ellipse(cx, by - ts * .02, ts * .14, ts * .04, 0, 0, Math.PI * 2); g.fill();
  const greens = v < .5 ? ['#3f8550', '#559f62', '#73bb76', '#9bd394'] : ['#4a8a48', '#62a95c', '#7fc073', '#a6d896'];
  const top = by - ts * (.98 + v * .2);
  const puffs = [[0, .18, .46], [-.24, -.02, .33], [.24, -.02, .33], [-.1, -.26, .3], [.12, -.24, .3]];
  // 由暗到亮疊三層，下方偏暗、左上偏亮，做出立體樹冠。
  puffs.forEach(([dx, dy, r]) => { g.fillStyle = greens[0]; g.beginPath(); g.arc(cx + dx * ts, top + (dy + .04) * ts, r * ts, 0, Math.PI * 2); g.fill(); });
  puffs.forEach(([dx, dy, r]) => { g.fillStyle = greens[1]; g.beginPath(); g.arc(cx + (dx - .02) * ts, top + (dy - .02) * ts, r * .9 * ts, 0, Math.PI * 2); g.fill(); });
  puffs.forEach(([dx, dy, r]) => { g.fillStyle = greens[2]; g.beginPath(); g.arc(cx + (dx - .06) * ts, top + (dy - .07) * ts, r * .55 * ts, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = greens[3]; g.beginPath(); g.arc(cx - ts * .16, top - ts * .3, ts * .08, 0, Math.PI * 2); g.fill();
  // 秋天的樹偶爾有紅果。
  if (v > .6) {
    g.fillStyle = '#e46a5b';
    for (const [dx, dy] of [[.18, .08], [-.2, .12], [.02, -.12]]) { g.beginPath(); g.arc(cx + dx * ts, top + dy * ts, ts * .035, 0, Math.PI * 2); g.fill(); }
  }
}

function drawRock(g, x, y, ts) {
  const cx = (x + .5) * ts, by = (y + .8) * ts;
  shadow(g, cx, by, ts * .44);
  g.fillStyle = '#8f9488'; g.beginPath(); g.ellipse(cx, by - ts * .18, ts * .36, ts * .26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#aab0a3'; g.beginPath(); g.ellipse(cx - ts * .03, by - ts * .23, ts * .3, ts * .2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9cec0'; g.beginPath(); g.ellipse(cx - ts * .1, by - ts * .3, ts * .13, ts * .07, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#86b46f'; g.beginPath(); g.ellipse(cx + ts * .14, by - ts * .38, ts * .1, ts * .04, .3, 0, Math.PI * 2); g.fill();
}

function drawHouse(g, ts) {
  const x = HOUSE.x * ts, y = HOUSE.y * ts, w = HOUSE.w * ts, h = HOUSE.h * ts;
  shadow(g, x + w / 2 + ts * .1, y + h - ts * .02, w * .62);
  // 牆面與木樑
  g.fillStyle = '#f6ecd6'; roundRect(g, x + ts * .15, y + ts * .55, w - ts * .3, h - ts * .6, ts * .1); g.fill();
  g.fillStyle = '#eadcbc'; g.fillRect(x + ts * .15, y + h - ts * .2, w - ts * .3, ts * .12);
  g.fillStyle = '#b98a5e';
  g.fillRect(x + ts * .15, y + ts * .62, w - ts * .3, ts * .06);
  g.fillRect(x + ts * .2, y + ts * .62, ts * .06, h - ts * .7); g.fillRect(x + w - ts * .26, y + ts * .62, ts * .06, h - ts * .7);
  // 煙囪
  g.fillStyle = '#9c5a49'; g.fillRect(x + w * .7, y - ts * .2, ts * .26, ts * .5);
  g.fillStyle = '#7f4639'; g.fillRect(x + w * .7 - ts * .03, y - ts * .24, ts * .32, ts * .08);
  // 屋頂：底色、瓦片橫紋、屋脊亮面
  g.fillStyle = '#c4614c';
  g.beginPath(); g.moveTo(x - ts * .1, y + ts * .78); g.lineTo(x + w / 2, y - ts * .38); g.lineTo(x + w + ts * .1, y + ts * .78); g.closePath(); g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(120,40,30,.35)'; g.lineWidth = Math.max(1, ts * .03);
  for (let k = 0; k < 6; k++) { const yy = y - ts * .2 + k * ts * .18; g.beginPath(); g.moveTo(x - ts * .2, yy); g.lineTo(x + w + ts * .2, yy); g.stroke(); }
  g.fillStyle = 'rgba(255,220,200,.25)'; g.beginPath(); g.moveTo(x + w / 2, y - ts * .38); g.lineTo(x - ts * .1, y + ts * .78); g.lineTo(x + ts * .4, y + ts * .78); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#a84f3e'; g.fillRect(x - ts * .12, y + ts * .74, w + ts * .24, ts * .07);
  // 門、台階、門燈
  g.fillStyle = '#d9c39b'; roundRect(g, x + w / 2 - ts * .34, y + h - ts * .1, ts * .68, ts * .1, ts * .03); g.fill();
  g.fillStyle = '#7d5236'; roundRect(g, x + w / 2 - ts * .24, y + h - ts * .8, ts * .48, ts * .72, ts * .2); g.fill();
  g.fillStyle = '#946444'; roundRect(g, x + w / 2 - ts * .18, y + h - ts * .72, ts * .36, ts * .26, ts * .14); g.fill();
  g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(x + w / 2 + ts * .12, y + h - ts * .42, ts * .035, 0, Math.PI * 2); g.fill();
  // 窗戶與花台
  for (const wx of [x + ts * .42, x + w - ts * .86]) {
    g.fillStyle = '#ffffff'; roundRect(g, wx - ts * .03, y + ts * .9, ts * .5, ts * .44, ts * .07); g.fill();
    g.fillStyle = '#a9dcea'; roundRect(g, wx, y + ts * .93, ts * .44, ts * .38, ts * .05); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(wx + ts * .05, y + ts * .96, ts * .08, ts * .3);
    g.fillStyle = '#ffffff'; g.fillRect(wx + ts * .2, y + ts * .93, ts * .03, ts * .38); g.fillRect(wx, y + ts * 1.1, ts * .44, ts * .03);
    g.fillStyle = '#8a5a3c'; g.fillRect(wx - ts * .04, y + ts * 1.33, ts * .52, ts * .07);
    for (let k = 0; k < 4; k++) { g.fillStyle = ['#f28b9b', '#ffd36b', '#f6a5b4', '#ffffff'][k]; g.beginPath(); g.arc(wx + ts * (.05 + k * .11), y + ts * 1.32, ts * .045, 0, Math.PI * 2); g.fill(); }
  }
}

function sparkle(g, x, y, ts, t, still, seed) {
  const tw = still ? .8 : (Math.sin(t / 300 + seed) + 1) / 2;
  g.fillStyle = 'rgba(255,255,255,' + (.35 + tw * .6).toFixed(2) + ')';
  g.beginPath(); g.arc(x, y, ts * (.03 + tw * .03), 0, Math.PI * 2); g.fill();
}

// 地上的採集物：貝殼、樹枝（木材）、葉子、果實。
function drawSpot(g, s, ts, t, still) {
  const cx = (s.x + .5) * ts, cy = (s.y + .6) * ts;
  shadow(g, cx, cy + ts * .12, ts * .2);
  g.save(); g.translate(cx, cy);
  g.lineWidth = Math.max(1, ts * .025);
  if (theme().id === 'xianxia') drawXSpot(g, s, ts);
  else if (s.material === 'shell') {
    g.fillStyle = '#f7c6c0';
    g.beginPath(); g.moveTo(0, ts * .1); g.arc(0, ts * .1, ts * .2, Math.PI * 1.1, Math.PI * 1.9); g.closePath(); g.fill();
    g.strokeStyle = '#e39a92';
    for (const a of [-.55, -.25, .05, .35]) {
      g.beginPath(); g.moveTo(0, ts * .1); g.lineTo(Math.sin(a) * ts * .18, ts * .1 - Math.cos(a) * ts * .18); g.stroke();
    }
  } else if (s.material === 'wood') {
    for (const [dy, rot] of [[.06, -.25], [-.04, .2]]) {
      g.save(); g.translate(0, dy * ts); g.rotate(rot);
      g.fillStyle = '#9a6b45'; roundRect(g, -ts * .2, -ts * .05, ts * .4, ts * .1, ts * .05); g.fill();
      g.fillStyle = '#d9b48a'; g.beginPath(); g.ellipse(ts * .2, 0, ts * .03, ts * .05, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  } else if (s.material === 'leaf') {
    g.save(); g.rotate(-.5);
    g.fillStyle = '#5fae5a';
    g.beginPath(); g.ellipse(0, 0, ts * .2, ts * .1, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3f8a44'; g.beginPath(); g.moveTo(-ts * .2, 0); g.lineTo(ts * .18, 0); g.stroke();
    g.restore();
  } else {
    g.fillStyle = '#e0574f'; g.beginPath(); g.arc(0, 0, ts * .14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a4a2e'; g.fillRect(-ts * .015, -ts * .2, ts * .03, ts * .08);
    g.fillStyle = '#5fae5a'; g.beginPath(); g.ellipse(ts * .06, -ts * .17, ts * .06, ts * .03, -.4, 0, Math.PI * 2); g.fill();
  }
  sparkle(g, ts * .13, -ts * .14, ts, t, still, s.x + s.y);
  g.restore();
}

// 擺放的家具（原點在格子底部中央）。
function drawFurniture(g, f, ts) {
  const cx = (f.x + .5) * ts, by = (f.y + .85) * ts;
  shadow(g, cx, by, ts * .3);
  g.save(); g.translate(cx, by);
  if (theme().id === 'xianxia') drawXFurniture(g, f, ts);
  else if (f.id === 'starter-stool') {
    g.fillStyle = '#9a6b45';
    g.fillRect(-ts * .18, -ts * .3, ts * .06, ts * .3); g.fillRect(ts * .12, -ts * .3, ts * .06, ts * .3);
    g.fillStyle = '#c8935f'; roundRect(g, -ts * .24, -ts * .42, ts * .48, ts * .14, ts * .06); g.fill();
  } else if (f.id === 'wood-chair') {
    g.fillStyle = '#8a5d3b';
    g.fillRect(-ts * .2, -ts * .3, ts * .06, ts * .3); g.fillRect(ts * .14, -ts * .3, ts * .06, ts * .3);
    g.fillRect(-ts * .2, -ts * .78, ts * .06, ts * .5); g.fillRect(ts * .14, -ts * .78, ts * .06, ts * .5);
    g.fillStyle = '#b98252'; roundRect(g, -ts * .22, -ts * .78, ts * .44, ts * .18, ts * .05); g.fill();
    g.fillStyle = '#c8935f'; roundRect(g, -ts * .25, -ts * .4, ts * .5, ts * .12, ts * .05); g.fill();
  } else if (f.id === 'flowerbed') {
    g.fillStyle = '#9a6b45'; roundRect(g, -ts * .36, -ts * .22, ts * .72, ts * .22, ts * .06); g.fill();
    g.fillStyle = '#6b4a30'; roundRect(g, -ts * .32, -ts * .24, ts * .64, ts * .08, ts * .04); g.fill();
    const cols = ['#f6a5b4', '#ffe28a', '#c7a6f0', '#ffffff'];
    for (let i = 0; i < 4; i++) {
      const x = -ts * .24 + i * ts * .16;
      g.strokeStyle = '#4f9a5d'; g.lineWidth = ts * .03; g.beginPath(); g.moveTo(x, -ts * .22); g.lineTo(x, -ts * .38); g.stroke();
      g.fillStyle = cols[i]; g.beginPath(); g.arc(x, -ts * .42, ts * .07, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2b33d'; g.beginPath(); g.arc(x, -ts * .42, ts * .025, 0, Math.PI * 2); g.fill();
    }
  } else if (f.id === 'lantern') {
    g.fillStyle = '#5a4636'; g.fillRect(-ts * .03, -ts * .5, ts * .06, ts * .5);
    g.fillStyle = 'rgba(255,214,120,.35)'; g.beginPath(); g.arc(0, -ts * .62, ts * .26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8834e'; roundRect(g, -ts * .13, -ts * .78, ts * .26, ts * .3, ts * .1); g.fill();
    g.fillStyle = '#ffe28a'; roundRect(g, -ts * .07, -ts * .72, ts * .14, ts * .18, ts * .05); g.fill();
    g.fillStyle = '#5a4636'; g.fillRect(-ts * .1, -ts * .82, ts * .2, ts * .05);
  }
  g.restore();
}

function eyes(g, n, ts, y, gap, nose) {
  if (n.facing === 'up') return;
  const ox = n.facing === 'left' ? -ts * .05 : n.facing === 'right' ? ts * .05 : 0;
  g.fillStyle = '#3a2a22';
  g.beginPath(); g.arc(ox - gap, y, ts * .026, 0, Math.PI * 2); g.arc(ox + gap, y, ts * .026, 0, Math.PI * 2); g.fill();
  if (nose) { g.beginPath(); g.arc(ox, y + ts * .07, ts * .022, 0, Math.PI * 2); g.fill(); }
}

// 四種居民的原創造型；原點在腳下中央。
const SPECIES = {
  fox(g, n, ts) {
    const c = n.colors, side = n.facing === 'left' ? -1 : 1;
    g.fillStyle = c.body; g.beginPath(); g.ellipse(-side * ts * .22, -ts * .32, ts * .12, ts * .22, -side * .5, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.belly; g.beginPath(); g.ellipse(-side * ts * .27, -ts * .48, ts * .06, ts * .07, 0, 0, Math.PI * 2); g.fill();
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
    }
    eyes(g, n, ts, -ts * .63, ts * .08, true);
  },
  bear(g, n, ts) {
    const c = n.colors;
    g.fillStyle = c.body; g.beginPath(); g.ellipse(0, -ts * .24, ts * .25, ts * .25, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.belly; g.beginPath(); g.ellipse(0, -ts * .2, ts * .14, ts * .15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.scarf; roundRect(g, -ts * .2, -ts * .47, ts * .4, ts * .08, ts * .04); g.fill();
    for (const s of [-1, 1]) {
      g.fillStyle = c.body; g.beginPath(); g.arc(s * ts * .17, -ts * .82, ts * .08, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.ear; g.beginPath(); g.arc(s * ts * .17, -ts * .82, ts * .04, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = c.body; g.beginPath(); g.arc(0, -ts * .64, ts * .23, 0, Math.PI * 2); g.fill();
    if (n.facing !== 'up') {
      const ox = n.facing === 'left' ? -ts * .05 : n.facing === 'right' ? ts * .05 : 0;
      g.fillStyle = c.belly; g.beginPath(); g.ellipse(ox, -ts * .56, ts * .09, ts * .07, 0, 0, Math.PI * 2); g.fill();
    }
    eyes(g, n, ts, -ts * .67, ts * .085, true);
  },
  bunny(g, n, ts) {
    const c = n.colors;
    g.fillStyle = c.body; g.beginPath(); g.ellipse(0, -ts * .2, ts * .19, ts * .2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.scarf; roundRect(g, -ts * .16, -ts * .4, ts * .32, ts * .07, ts * .035); g.fill();
    for (const s of [-1, 1]) {
      g.fillStyle = c.body; g.beginPath(); g.ellipse(s * ts * .08, -ts * .92, ts * .06, ts * .19, s * .15, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.ear; g.beginPath(); g.ellipse(s * ts * .08, -ts * .9, ts * .03, ts * .13, s * .15, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = c.body; g.beginPath(); g.arc(0, -ts * .57, ts * .2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,110,100,.25)'; g.lineWidth = ts * .015;
    g.beginPath(); g.arc(0, -ts * .57, ts * .2, 0, Math.PI * 2); g.stroke();
    if (n.facing === 'down') {
      g.fillStyle = 'rgba(240,140,150,.5)';
      g.beginPath(); g.arc(-ts * .12, -ts * .52, ts * .035, 0, Math.PI * 2); g.arc(ts * .12, -ts * .52, ts * .035, 0, Math.PI * 2); g.fill();
    }
    eyes(g, n, ts, -ts * .6, ts * .075, false);
  },
  owl(g, n, ts) {
    const c = n.colors;
    g.fillStyle = c.body; g.beginPath(); g.ellipse(0, -ts * .38, ts * .24, ts * .36, 0, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * ts * .2, -ts * .78); g.lineTo(s * ts * .08, -ts * .66); g.lineTo(s * ts * .22, -ts * .6); g.closePath(); g.fill(); }
    g.fillStyle = c.belly; g.beginPath(); g.ellipse(0, -ts * .22, ts * .15, ts * .17, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = c.ear; g.lineWidth = ts * .02;
    for (const y of [-.28, -.2]) { g.beginPath(); g.arc(0, y * ts, ts * .06, .2, Math.PI - .2); g.stroke(); }
    if (n.facing !== 'up') {
      const ox = n.facing === 'left' ? -ts * .05 : n.facing === 'right' ? ts * .05 : 0;
      for (const s of [-1, 1]) {
        g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(ox + s * ts * .09, -ts * .55, ts * .08, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2e2a3a'; g.beginPath(); g.arc(ox + s * ts * .09, -ts * .55, ts * .04, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = c.scarf; g.beginPath(); g.moveTo(ox - ts * .04, -ts * .47); g.lineTo(ox + ts * .04, -ts * .47); g.lineTo(ox, -ts * .4); g.closePath(); g.fill();
    }
    // 小眼鏡（諮商／訂正的「仔細看」）
    if (n.facing === 'down') {
      g.strokeStyle = '#3a3550'; g.lineWidth = ts * .018;
      g.beginPath(); g.arc(-ts * .09, -ts * .55, ts * .085, 0, Math.PI * 2); g.moveTo(ts * .175, -ts * .55); g.arc(ts * .09, -ts * .55, ts * .085, 0, Math.PI * 2); g.stroke();
    }
  }
};

function drawNpc(g, n, ts, t, still) {
  const cx = (n.rx + .5) * ts, by = (n.ry + .88) * ts;
  const bob = still || !n.moving ? 0 : Math.abs(Math.sin(t / 110)) * ts * .04;
  shadow(g, cx, by, ts * .34);
  const sp = outlined('npc|' + n.id + '|' + n.facing, ts, spriteDpr, c =>
    (theme().id === 'xianxia' ? drawRobed(c, n.robe, n.facing, ts) : SPECIES[n.species](c, n, ts)));
  g.drawImage(sp.cv, cx - sp.ox, by - bob - sp.oy, sp.W, sp.H);
  g.save(); g.translate(cx, by - bob);
  if (n.quest) {
    const qy = -ts * 1.18 - (still ? 0 : Math.sin(t / 250) * ts * .04);
    g.fillStyle = '#fffaf0'; g.strokeStyle = '#e0a43a'; g.lineWidth = Math.max(1.5, ts * .04);
    g.beginPath(); g.arc(0, qy, ts * .14, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#c47f12'; g.font = '800 ' + Math.round(ts * .2) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', 0, qy + ts * .01);
  }
  g.restore();
}

// 對話框的居民頭像（同一套繪製程式，放大畫在小 canvas 上）。
export function drawPortrait(cv, npc) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2), size = cv.clientWidth || 56;
  cv.width = size * dpr; cv.height = size * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const ts = size * 1.05;
  g.translate(size / 2, size * (npc.species === 'bunny' || npc.species === 'owl' ? .98 : 1.02));
  if (theme().id === 'xianxia') { g.translate(0, -size * .02); drawRobed(g, npc.robe, 'down', ts * .95); }
  else SPECIES[npc.species](g, { ...npc, facing: 'down' }, ts);
}

// 島嶼主題的主角（原點在腳下中央）。
function playerBody(g, facing, ts, step, outfit) {
  // 腳
  g.fillStyle = '#5a4636';
  g.beginPath(); g.ellipse(-ts * .08, -ts * .03 + step * ts * .02, ts * .06, ts * .04, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(ts * .08, -ts * .03 - step * ts * .02, ts * .06, ts * .04, 0, 0, Math.PI * 2); g.fill();
  // 身體
  g.fillStyle = outfit.trim;
  g.beginPath(); g.ellipse(-ts * .17, -ts * .22 - step * ts * .02, ts * .05, ts * .09, .2, 0, Math.PI * 2); g.ellipse(ts * .17, -ts * .22 + step * ts * .02, ts * .05, ts * .09, -.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = outfit.shirt; roundRect(g, -ts * .16, -ts * .38, ts * .32, ts * .34, ts * .1); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)'; roundRect(g, -ts * .12, -ts * .36, ts * .1, ts * .2, ts * .05); g.fill();
  g.fillStyle = outfit.trim; g.fillRect(-ts * .16, -ts * .12, ts * .32, ts * .05);
  // 頭與頭髮
  g.fillStyle = '#f4d5b8'; g.beginPath(); g.arc(0, -ts * .58, ts * .22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5b3f2e';
  if (facing === 'up') {
    g.beginPath(); g.arc(0, -ts * .6, ts * .225, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.arc(0, -ts * .64, ts * .225, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    const ox = facing === 'left' ? -ts * .06 : facing === 'right' ? ts * .06 : 0;
    g.fillStyle = '#3a2a22';
    if (facing === 'down') {
      g.beginPath(); g.arc(-ts * .08, -ts * .55, ts * .028, 0, Math.PI * 2); g.arc(ts * .08, -ts * .55, ts * .028, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(240,140,130,.5)';
      g.beginPath(); g.arc(-ts * .13, -ts * .49, ts * .035, 0, Math.PI * 2); g.arc(ts * .13, -ts * .49, ts * .035, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.arc(ox + (facing === 'left' ? -ts * .04 : ts * .04), -ts * .55, ts * .028, 0, Math.PI * 2); g.fill();
    }
  }
}

// 角色描邊：把角色畫到離屏 canvas，向八方偏移後填成描邊色，再疊上原圖。依「主題、角色、方向、步伐」快取，不會每幀重算。
const sprites = new Map();
let spriteScale = { ts: 0, dpr: 0 };
function outlined(key, ts, dpr, drawFn) {
  if (spriteScale.ts !== ts || spriteScale.dpr !== dpr) { sprites.clear(); spriteScale = { ts, dpr }; }
  const full = theme().id + '|' + key;
  let sp = sprites.get(full);
  if (sp) return sp;
  const W = ts * 1.4, H = ts * 1.5, ox = W / 2, oy = H - ts * .12;
  const make = () => { const c = document.createElement('canvas'); c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); return c; };
  const base = make(), bg = base.getContext('2d');
  bg.scale(dpr, dpr); bg.translate(ox, oy); drawFn(bg);
  const out = make(), og = out.getContext('2d');
  const d = Math.max(1, ts * .03) * dpr;
  for (let k = 0; k < 8; k++) og.drawImage(base, Math.round(Math.cos(k * Math.PI / 4) * d), Math.round(Math.sin(k * Math.PI / 4) * d));
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = pal().outline; og.fillRect(0, 0, out.width, out.height);
  og.globalCompositeOperation = 'source-over';
  og.drawImage(base, 0, 0);
  sp = { cv: out, W, H, ox, oy };
  sprites.set(full, sp);
  return sp;
}
let spriteDpr = 1;

function drawPlayer(g, p, ts, t, still, outfit) {
  const cx = (p.rx + .5) * ts, by = (p.ry + .9) * ts;
  const step = still || !p.moving ? 0 : Math.sin(t / 90);
  const q = Math.round(step);
  shadow(g, cx, by, ts * .3);
  const sp = outlined('player|' + outfit.id + '|' + p.facing + '|' + q, ts, spriteDpr, c =>
    (theme().id === 'xianxia' ? drawRobed(c, playerLook(outfit), p.facing, ts, q) : playerBody(c, p.facing, ts, q, outfit)));
  g.drawImage(sp.cv, cx - sp.ox, by - Math.abs(step) * ts * .035 - sp.oy, sp.W, sp.H);
}

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');
  let ts = 48, dpr = 1, vw = 0, vh = 0, terrain = null, terrainTheme = null;
  const trees = tilesOf('tree'), rocks = tilesOf('rock');

  function resize(w, h) {
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    spriteDpr = dpr;
    vw = w; vh = h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const next = Math.round(Math.max(36, Math.min(64, Math.min(w, h) / 8.5)));
    if (next !== ts || !terrain) { ts = next; terrain = null; }
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
    // 主題或尺寸改變時才重畫靜態地表。
    if (!terrain || terrainTheme !== theme().id) { terrain = drawTerrain(Math.round(ts * dpr)); terrainTheme = theme().id; }
    g.fillStyle = pal().waterDeep; g.fillRect(0, 0, vw, vh);
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
    if (s.placeHints) {
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (const h of s.placeHints) { g.beginPath(); g.arc((h.x + .5) * ts, (h.y + .5) * ts, ts * .09, 0, Math.PI * 2); g.fill(); }
    }
    const items = [];
    const xian = theme().id === 'xianxia';
    for (const t of trees) items.push({ y: t.y + .9, fn: () => (xian ? drawBamboo : drawTree)(g, t.x, t.y, ts) });
    for (const r of rocks) items.push({ y: r.y + .8, fn: () => (xian ? drawStone : drawRock)(g, r.x, r.y, ts) });
    items.push({ y: HOUSE.y + HOUSE.h, fn: () => (xian ? drawCaveHouse : drawHouse)(g, ts) });
    for (const sp of s.spots) items.push({ y: sp.y + .5, fn: () => drawSpot(g, sp, ts, s.time, s.still) });
    for (const f of s.placed) items.push({ y: f.y + .85, fn: () => drawFurniture(g, f, ts) });
    for (const n of s.npcs) items.push({ y: n.ry + .88, fn: () => drawNpc(g, n, ts, s.time, s.still) });
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
    atmosphere();
  }

  // 依裝置時間的淡淡色調（清晨、傍晚、夜晚）與畫面四角的柔和暗角；只是氛圍，不影響可讀性。
  let vignette = null, vignetteSize = '';
  function atmosphere() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const h = new Date().getHours(), xian = theme().id === 'xianxia';
    const tint = h >= 5 && h < 7 ? 'rgba(255,190,170,.08)'
      : h >= 17 && h < 19 ? 'rgba(255,170,90,.1)'
        : h >= 19 || h < 5 ? (xian ? 'rgba(40,50,110,.18)' : 'rgba(30,45,100,.18)') : null;
    if (tint) { g.fillStyle = tint; g.fillRect(0, 0, vw, vh); }
    const key = vw + 'x' + vh;
    if (vignetteSize !== key) {
      vignette = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * .45, vw / 2, vh / 2, Math.hypot(vw, vh) * .6);
      vignette.addColorStop(0, 'rgba(20,40,40,0)'); vignette.addColorStop(1, 'rgba(20,40,40,.16)');
      vignetteSize = key;
    }
    g.fillStyle = vignette; g.fillRect(0, 0, vw, vh);
  }

  function tileToScreen(x, y, p) {
    const cam = camera(p);
    return { x: (x + .5) * ts - cam.x, y: (y + .5) * ts - cam.y };
  }

  return { resize, draw, screenToTile, tileToScreen, get tileSize() { return ts; } };
}
