// 場景擺設、會動的環境（水面波光、季節飄落物）與夜間燈光。全部是原創向量圖形；
// 開啟「減少動態效果」時不畫飄落物、不閃爍。
import { MAP_W, MAP_H, tileAt, hash2, HOUSE } from './world/map.js';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function softShadow(g, x, y, w) {
  g.save(); g.translate(x, y); g.scale(1, .38);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, w);
  rg.addColorStop(0, 'rgba(30,60,45,.26)'); rg.addColorStop(1, 'rgba(30,60,45,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, w, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ── 擺設：島嶼／修仙各一種造型 ──
export function drawProp(g, id, x, y, ts, t, still, xian) {
  const cx = (x + .5) * ts, by = (y + .88) * ts;
  softShadow(g, cx, by, ts * .42);
  g.save(); g.translate(cx, by);
  (xian ? XIAN_PROPS : ISLAND_PROPS)[id](g, ts, t, still, x, y);
  g.restore();
}

const ISLAND_PROPS = {
  barrel(g, ts) {
    for (const [dx, s] of [[-.12, 1], [.18, .8]]) {
      const w = ts * .28 * s, h = ts * .42 * s;
      g.fillStyle = '#9a6a43'; roundRect(g, dx * ts - w / 2, -h, w, h, ts * .06); g.fill();
      g.fillStyle = '#b5824f'; roundRect(g, dx * ts - w / 2, -h, w * .45, h, ts * .05); g.fill();
      g.fillStyle = '#5d5550'; g.fillRect(dx * ts - w / 2, -h * .78, w, ts * .03); g.fillRect(dx * ts - w / 2, -h * .3, w, ts * .03);
      g.fillStyle = '#c99a69'; g.beginPath(); g.ellipse(dx * ts, -h, w / 2, ts * .05 * s, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#e0574f';
    for (const [ax, ay] of [[-.17, -.47], [-.07, -.48], [-.12, -.53]]) { g.beginPath(); g.arc(ax * ts, ay * ts, ts * .045, 0, Math.PI * 2); g.fill(); }
  },
  mailbox(g, ts) {
    g.fillStyle = '#8a6142'; g.fillRect(-ts * .035, -ts * .48, ts * .07, ts * .48);
    g.fillStyle = '#d65a4a'; roundRect(g, -ts * .17, -ts * .68, ts * .34, ts * .22, ts * .1); g.fill();
    g.fillStyle = '#e8786a'; roundRect(g, -ts * .15, -ts * .66, ts * .12, ts * .18, ts * .06); g.fill();
    g.fillStyle = '#f2c94c'; g.fillRect(ts * .14, -ts * .78, ts * .03, ts * .16); g.fillRect(ts * .14, -ts * .78, ts * .1, ts * .06);
  },
  lamp(g, ts) {
    g.fillStyle = '#3f5b55'; g.fillRect(-ts * .03, -ts * .9, ts * .06, ts * .9);
    g.fillRect(-ts * .1, -ts * .04, ts * .2, ts * .05);
    g.fillStyle = '#2f4843'; g.beginPath(); g.moveTo(-ts * .14, -ts * .9); g.lineTo(0, -ts * 1.02); g.lineTo(ts * .14, -ts * .9); g.closePath(); g.fill();
    g.fillStyle = '#ffe9a8'; roundRect(g, -ts * .09, -ts * .9, ts * .18, ts * .16, ts * .03); g.fill();
    g.fillStyle = '#2f4843'; g.fillRect(-ts * .11, -ts * .75, ts * .22, ts * .03);
  },
  sign(g, ts) {
    g.fillStyle = '#7b543a'; g.fillRect(-ts * .035, -ts * .62, ts * .07, ts * .62);
    g.fillStyle = '#c99a69';
    g.beginPath(); g.moveTo(-ts * .26, -ts * .6); g.lineTo(ts * .18, -ts * .6); g.lineTo(ts * .28, -ts * .51); g.lineTo(ts * .18, -ts * .42); g.lineTo(-ts * .26, -ts * .42); g.closePath(); g.fill();
    g.fillStyle = '#8a6142'; g.fillRect(-ts * .19, -ts * .53, ts * .3, ts * .02); g.fillRect(-ts * .19, -ts * .49, ts * .22, ts * .02);
  },
  crops(g, ts, t, still, x, y) {
    g.fillStyle = '#8d6748'; roundRect(g, -ts * .45, -ts * .3, ts * .9, ts * .3, ts * .08); g.fill();
    g.fillStyle = '#76553a'; for (let k = 0; k < 3; k++) g.fillRect(-ts * .4, -ts * (.26 - k * .09), ts * .8, ts * .025);
    for (const [px, s] of [[-.22, 1], [.05, .8], [.28, 1.1]]) {
      const r = ts * .1 * s * (.85 + hash2(x, y, px * 10) * .3);
      g.fillStyle = '#6aa85a'; g.beginPath(); g.ellipse(px * ts + r * .8, -ts * .2 - r, r * .7, r * .35, -.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e88a3a'; g.beginPath(); g.ellipse(px * ts, -ts * .14, r * 1.15, r * .9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2a659'; g.beginPath(); g.ellipse(px * ts - r * .35, -ts * .16, r * .35, r * .7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6b4a2e'; g.fillRect(px * ts - ts * .01, -ts * .14 - r * 1.05, ts * .02, ts * .05);
    }
  }
};

const XIAN_PROPS = {
  // 丹爐：三足青銅爐，爐頂有輕煙。
  barrel(g, ts, t, still) {
    g.fillStyle = '#6d5a3a';
    for (const dx of [-.16, 0, .16]) g.fillRect(dx * ts - ts * .025, -ts * .12, ts * .05, ts * .12);
    g.fillStyle = '#9b7c45'; g.beginPath(); g.ellipse(0, -ts * .3, ts * .26, ts * .2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b8955a'; g.beginPath(); g.ellipse(-ts * .08, -ts * .34, ts * .1, ts * .1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6d5a3a'; g.fillRect(-ts * .22, -ts * .48, ts * .44, ts * .05);
    g.fillStyle = '#8a6c3c'; g.beginPath(); g.ellipse(0, -ts * .5, ts * .12, ts * .05, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8803a'; g.beginPath(); g.ellipse(0, -ts * .2, ts * .06, ts * .03, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 3; k++) {
      const ph = still ? k / 3 : ((t / 2400 + k / 3) % 1);
      g.fillStyle = 'rgba(255,255,255,' + (.5 * (1 - ph)).toFixed(2) + ')';
      g.beginPath(); g.arc(Math.sin(ph * 6 + k) * ts * .06, -ts * (.56 + ph * .5), ts * (.05 + ph * .07), 0, Math.PI * 2); g.fill();
    }
  },
  // 石碑
  mailbox(g, ts) {
    g.fillStyle = '#8b9192'; roundRect(g, -ts * .22, -ts * .1, ts * .44, ts * .1, ts * .02); g.fill();
    g.fillStyle = '#a3abac'; roundRect(g, -ts * .15, -ts * .72, ts * .3, ts * .64, ts * .1); g.fill();
    g.fillStyle = '#bcc3c3'; roundRect(g, -ts * .15, -ts * .72, ts * .1, ts * .64, ts * .06); g.fill();
    g.fillStyle = '#6f7778'; for (let k = 0; k < 4; k++) g.fillRect(-ts * .03, -ts * (.6 - k * .11), ts * .06, ts * .06);
  },
  // 石燈
  lamp(g, ts) {
    g.fillStyle = '#9aa3a6'; g.fillRect(-ts * .06, -ts * .45, ts * .12, ts * .45);
    g.fillStyle = '#8a9295'; roundRect(g, -ts * .16, -ts * .06, ts * .32, ts * .08, ts * .02); g.fill();
    g.fillStyle = '#b5bcbe'; roundRect(g, -ts * .16, -ts * .74, ts * .32, ts * .3, ts * .04); g.fill();
    g.fillStyle = '#ffe08a'; roundRect(g, -ts * .08, -ts * .68, ts * .16, ts * .16, ts * .03); g.fill();
    g.fillStyle = '#7d878a'; g.beginPath(); g.moveTo(-ts * .25, -ts * .74); g.quadraticCurveTo(0, -ts * .98, ts * .25, -ts * .74); g.closePath(); g.fill();
  },
  // 木匾
  sign(g, ts) {
    g.fillStyle = '#6b4a30'; g.fillRect(-ts * .26, -ts * .7, ts * .05, ts * .7); g.fillRect(ts * .21, -ts * .7, ts * .05, ts * .7);
    g.fillStyle = '#3f2e24'; roundRect(g, -ts * .3, -ts * .74, ts * .6, ts * .26, ts * .03); g.fill();
    g.strokeStyle = '#c9a45c'; g.lineWidth = ts * .02; roundRect(g, -ts * .27, -ts * .71, ts * .54, ts * .2, ts * .02); g.stroke();
    g.fillStyle = '#e8c56a'; g.fillRect(-ts * .15, -ts * .63, ts * .3, ts * .035);
  },
  // 藥圃：竹籬圍起的靈草
  crops(g, ts, t, still, x, y) {
    g.fillStyle = '#7d6a52'; roundRect(g, -ts * .45, -ts * .26, ts * .9, ts * .26, ts * .06); g.fill();
    for (let k = 0; k < 5; k++) {
      const px = -ts * .34 + k * ts * .17, s = .8 + hash2(x, y, k) * .4;
      g.fillStyle = '#4f9a58';
      for (const rot of [-.6, 0, .6]) { g.save(); g.translate(px, -ts * .2); g.rotate(rot); g.beginPath(); g.ellipse(0, -ts * .08 * s, ts * .025, ts * .09 * s, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.fillStyle = k % 2 ? '#ffffff' : '#f2e48a'; g.beginPath(); g.arc(px, -ts * .36 * s, ts * .025, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#8fb06a';
    for (let k = 0; k < 7; k++) g.fillRect(-ts * .45 + k * ts * .148, -ts * .34, ts * .03, ts * .34);
    g.fillRect(-ts * .45, -ts * .27, ts * .9, ts * .025);
  }
};

// ── 水面波光：只畫在鏡頭內、雜湊選中的水格上，亮度隨時間呼吸 ──
export function drawShimmer(g, ts, t, view, xian) {
  const x0 = Math.max(0, Math.floor(view.x / ts)), y0 = Math.max(0, Math.floor(view.y / ts));
  const x1 = Math.min(MAP_W, Math.ceil((view.x + view.w) / ts)), y1 = Math.min(MAP_H, Math.ceil((view.y + view.h) / ts));
  g.lineCap = 'round';
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (tileAt(x, y).id !== 'water') continue;
    const h = hash2(x, y, 90);
    if (h > .45) continue;
    const a = (Math.sin(t / (xian ? 1500 : 650) + h * 40) + 1) / 2;
    if (a < .35) continue;
    const px = (x + .2 + hash2(x, y, 91) * .6) * ts, py = (y + .3 + hash2(x, y, 92) * .4) * ts;
    if (xian) {
      g.fillStyle = 'rgba(255,255,255,' + (a * .35).toFixed(2) + ')';
      g.beginPath(); g.ellipse(px + Math.sin(t / 3000 + h * 9) * ts * .15, py, ts * .22, ts * .05, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.strokeStyle = 'rgba(255,255,255,' + (a * .7).toFixed(2) + ')'; g.lineWidth = Math.max(1, ts * .03);
      g.beginPath(); g.moveTo(px - ts * .08, py); g.lineTo(px + ts * .08, py); g.stroke();
    }
  }
}

// ── 季節飄落物（螢幕座標）：春花瓣、夏蒲公英、秋落葉、冬雪；修仙主題是金色靈光 ──
export function createParticles() {
  let parts = [], lastT = 0, kind = '';
  function reset(w, h, k) {
    kind = k;
    const n = k === 'none' ? 0 : 16;
    parts = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h, s: .6 + Math.random() * .7, ph: Math.random() * 6.28, i
    }));
  }
  function draw(g, w, h, t, k, ts) {
    if (k !== kind || !parts.length && k !== 'none') reset(w, h, k);
    const dt = Math.min(.1, lastT ? (t - lastT) / 1000 : 0); lastT = t;
    for (const p of parts) {
      const sp = ts * p.s;
      if (k === 'snow') { p.y += sp * .5 * dt; p.x += Math.sin(t / 1200 + p.ph) * sp * .15 * dt; }
      else if (k === 'motes') { p.y -= sp * .18 * dt; p.x += Math.sin(t / 1800 + p.ph) * sp * .12 * dt; }
      else { p.y += sp * .45 * dt; p.x += sp * .3 * dt + Math.sin(t / 900 + p.ph) * sp * .2 * dt; }
      if (p.y > h + 10) p.y = -10; if (p.y < -10) p.y = h + 10;
      if (p.x > w + 10) p.x = -10; if (p.x < -10) p.x = w + 10;
      g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(t / 700 + p.ph) * .8);
      if (k === 'leaves') {
        g.fillStyle = ['#e8873f', '#d9643b', '#f0b54a'][p.i % 3];
        g.beginPath(); g.ellipse(0, 0, ts * .07 * p.s, ts * .035 * p.s, 0, 0, Math.PI * 2); g.fill();
      } else if (k === 'petals') {
        g.fillStyle = 'rgba(248,190,205,.9)';
        g.beginPath(); g.ellipse(0, 0, ts * .05 * p.s, ts * .03 * p.s, 0, 0, Math.PI * 2); g.fill();
      } else if (k === 'seeds') {
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1;
        for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * ts * .05, Math.sin(a) * ts * .05); g.stroke(); }
      } else if (k === 'snow') {
        g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(0, 0, ts * .035 * p.s, 0, Math.PI * 2); g.fill();
      } else if (k === 'motes') {
        const a = (Math.sin(t / 600 + p.ph) + 1) / 2;
        const rg = g.createRadialGradient(0, 0, 0, 0, 0, ts * .1 * p.s);
        rg.addColorStop(0, 'rgba(255,236,160,' + (.5 + a * .4).toFixed(2) + ')'); rg.addColorStop(1, 'rgba(255,236,160,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(0, 0, ts * .1 * p.s, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }
  return { draw };
}

export function particleKind(xian, d = new Date()) {
  if (xian) return 'motes';
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 5 ? 'petals' : m >= 6 && m <= 8 ? 'seeds' : m >= 9 && m <= 11 ? 'leaves' : 'snow';
}

// ── 夜間燈光：路燈、石燈、長明燈、小屋窗戶或洞府燈籠，以加亮模式疊上暖光 ──
export function lightSources(placed, lamps, xian) {
  const L = lamps.map(p => ({ x: p.x + .5, y: p.y - .05, r: 1.6 }));
  for (const f of placed) if (f.id === 'lantern') L.push({ x: f.x + .5, y: f.y + .2, r: 1.3 });
  if (xian) L.push({ x: HOUSE.x + .4, y: HOUSE.y + .82, r: 1 }, { x: HOUSE.x + HOUSE.w - .4, y: HOUSE.y + .82, r: 1 });
  else L.push({ x: HOUSE.x + .65, y: HOUSE.y + 1.1, r: 1 }, { x: HOUSE.x + HOUSE.w - .65, y: HOUSE.y + 1.1, r: 1 });
  return L;
}

export function drawLights(g, ts, lights, strength) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const rg = g.createRadialGradient(l.x * ts, l.y * ts, 0, l.x * ts, l.y * ts, l.r * ts);
    rg.addColorStop(0, 'rgba(255,200,110,' + (.45 * strength).toFixed(2) + ')');
    rg.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(l.x * ts, l.y * ts, l.r * ts, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
