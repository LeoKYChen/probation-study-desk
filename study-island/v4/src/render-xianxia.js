// 修仙主題的原創向量造型：靈竹、洞府、靈材、器物、同門與道袍主角。原點與尺寸慣例同 render.js。
import { HOUSE, hash2 } from './world/map.js';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function shadow(g, x, y, w) {
  g.fillStyle = 'rgba(40,70,60,.16)';
  g.beginPath(); g.ellipse(x, y, w, w * .38, 0, 0, Math.PI * 2); g.fill();
}

// 靈竹：三根竹竿、竹節與竹葉。
export function drawBamboo(g, x, y, ts) {
  const cx = (x + .5) * ts, by = (y + .92) * ts, v = hash2(x, y, 5);
  shadow(g, cx, by, ts * .38);
  [[-.16, 1.15], [.02, 1.45 + v * .2], [.18, 1.05]].forEach(([dx, h], i) => {
    const sx = cx + dx * ts, top = by - h * ts;
    g.fillStyle = i === 1 ? '#5f9e5a' : '#6fae66';
    roundRect(g, sx - ts * .045, top, ts * .09, h * ts, ts * .04); g.fill();
    g.fillStyle = '#4c8549';
    for (let k = 1; k < 4; k++) g.fillRect(sx - ts * .05, top + h * ts * k / 4, ts * .1, ts * .02);
    g.fillStyle = '#7cc274';
    for (const [lx, ly, rot] of [[.12, .1, -.5], [-.12, .25, .5], [.1, .45, -.3]]) {
      g.save(); g.translate(sx + lx * ts, top + ly * ts); g.rotate(rot);
      g.beginPath(); g.ellipse(0, 0, ts * .13, ts * .035, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  });
}

export function drawStone(g, x, y, ts) {
  const cx = (x + .5) * ts, by = (y + .8) * ts;
  shadow(g, cx, by, ts * .36);
  g.fillStyle = '#a7b2b5'; g.beginPath(); g.ellipse(cx, by - ts * .22, ts * .3, ts * .3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c4ccce'; g.beginPath(); g.ellipse(cx - ts * .08, by - ts * .32, ts * .12, ts * .08, -.3, 0, Math.PI * 2); g.fill();
}

// 洞府：灰瓦飛簷、紅柱、圓形月洞門。
export function drawCaveHouse(g, ts) {
  const x = HOUSE.x * ts, y = HOUSE.y * ts, w = HOUSE.w * ts, h = HOUSE.h * ts;
  shadow(g, x + w / 2, y + h - ts * .05, w * .55);
  g.fillStyle = '#ece4d3'; roundRect(g, x + ts * .2, y + ts * .5, w - ts * .4, h - ts * .55, ts * .06); g.fill();
  g.fillStyle = '#b8473c';
  g.fillRect(x + ts * .28, y + ts * .55, ts * .12, h - ts * .6); g.fillRect(x + w - ts * .4, y + ts * .55, ts * .12, h - ts * .6);
  // 屋頂（兩端上翹）
  g.fillStyle = '#5d6b78';
  g.beginPath();
  g.moveTo(x - ts * .25, y + ts * .38);
  g.quadraticCurveTo(x + ts * .2, y + ts * .55, x + ts * .35, y + ts * .15);
  g.lineTo(x + w - ts * .35, y + ts * .15);
  g.quadraticCurveTo(x + w - ts * .2, y + ts * .55, x + w + ts * .25, y + ts * .38);
  g.lineTo(x + w + ts * .05, y + ts * .62); g.lineTo(x - ts * .05, y + ts * .62); g.closePath(); g.fill();
  g.fillStyle = '#7a8996'; g.fillRect(x + ts * .35, y + ts * .05, w - ts * .7, ts * .14);
  // 月洞門
  g.fillStyle = '#3f3a36'; g.beginPath(); g.arc(x + w / 2, y + h - ts * .32, ts * .3, Math.PI, 0); g.fillRect(x + w / 2 - ts * .3, y + h - ts * .32, ts * .6, ts * .3); g.fill();
  // 匾額
  g.fillStyle = '#2f3b44'; roundRect(g, x + w / 2 - ts * .32, y + ts * .66, ts * .64, ts * .18, ts * .03); g.fill();
  g.fillStyle = '#e8c56a'; g.fillRect(x + w / 2 - ts * .2, y + ts * .73, ts * .4, ts * .04);
}

// 靈材：靈石（晶石）、靈竹節、靈草、靈果（桃）。原點在格子中下方。
export function drawXSpot(g, s, ts) {
  if (s.material === 'shell') {
    g.fillStyle = '#7fd3e0';
    g.beginPath(); g.moveTo(0, -ts * .2); g.lineTo(ts * .13, -ts * .02); g.lineTo(0, ts * .12); g.lineTo(-ts * .13, -ts * .02); g.closePath(); g.fill();
    g.fillStyle = '#c7f1f6';
    g.beginPath(); g.moveTo(0, -ts * .2); g.lineTo(ts * .05, -ts * .02); g.lineTo(0, ts * .12); g.lineTo(-ts * .04, -ts * .02); g.closePath(); g.fill();
  } else if (s.material === 'wood') {
    g.save(); g.rotate(-.35);
    g.fillStyle = '#6fae66'; roundRect(g, -ts * .2, -ts * .05, ts * .4, ts * .1, ts * .05); g.fill();
    g.fillStyle = '#4c8549'; g.fillRect(-ts * .02, -ts * .055, ts * .03, ts * .11);
    g.restore();
  } else if (s.material === 'leaf') {
    g.fillStyle = '#4f9a58';
    for (const rot of [-.7, 0, .7]) {
      g.save(); g.rotate(rot); g.beginPath(); g.ellipse(0, -ts * .1, ts * .05, ts * .12, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.fillStyle = '#f2e48a'; g.beginPath(); g.arc(0, -ts * .02, ts * .03, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = '#f4a3a8'; g.beginPath(); g.arc(0, 0, ts * .13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e57f89'; g.beginPath(); g.moveTo(0, -ts * .13); g.quadraticCurveTo(ts * .04, 0, 0, ts * .12); g.lineWidth = ts * .02; g.strokeStyle = '#e57f89'; g.stroke();
    g.fillStyle = '#5fae5a'; g.beginPath(); g.ellipse(ts * .07, -ts * .14, ts * .07, ts * .03, -.4, 0, Math.PI * 2); g.fill();
  }
}

// 器物：蒲團、靈草圃、長明燈。原點在格子底部中央。
export function drawXFurniture(g, f, ts) {
  if (f.id === 'starter-stool' || f.id === 'wood-chair') {
    const big = f.id === 'wood-chair';
    g.fillStyle = big ? '#c9a45c' : '#d8bf86';
    g.beginPath(); g.ellipse(0, -ts * .14, ts * (big ? .3 : .26), ts * .14, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = big ? '#9c7a3a' : '#b49a62'; g.lineWidth = ts * .02;
    for (const r of [.08, .16]) { g.beginPath(); g.ellipse(0, -ts * .16, ts * r * 1.6, ts * r * .7, 0, 0, Math.PI * 2); g.stroke(); }
  } else if (f.id === 'flowerbed') {
    g.fillStyle = '#8a8f8a'; roundRect(g, -ts * .34, -ts * .2, ts * .68, ts * .2, ts * .05); g.fill();
    g.fillStyle = '#5d4a3a'; g.fillRect(-ts * .3, -ts * .22, ts * .6, ts * .06);
    for (let i = 0; i < 4; i++) {
      const x = -ts * .22 + i * ts * .15;
      g.fillStyle = '#4f9a58';
      for (const rot of [-.5, .5]) { g.save(); g.translate(x, -ts * .26); g.rotate(rot); g.beginPath(); g.ellipse(0, -ts * .06, ts * .03, ts * .08, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.fillStyle = '#f2e48a'; g.beginPath(); g.arc(x, -ts * .36, ts * .025, 0, Math.PI * 2); g.fill();
    }
  } else if (f.id === 'lantern') {
    g.fillStyle = '#9aa3a6'; g.fillRect(-ts * .06, -ts * .45, ts * .12, ts * .45);
    g.fillStyle = 'rgba(255,224,140,.35)'; g.beginPath(); g.arc(0, -ts * .6, ts * .26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b5bcbe'; roundRect(g, -ts * .16, -ts * .74, ts * .32, ts * .3, ts * .04); g.fill();
    g.fillStyle = '#ffe08a'; roundRect(g, -ts * .08, -ts * .68, ts * .16, ts * .16, ts * .03); g.fill();
    g.fillStyle = '#7d878a';
    g.beginPath(); g.moveTo(-ts * .24, -ts * .74); g.lineTo(0, -ts * .9); g.lineTo(ts * .24, -ts * .74); g.closePath(); g.fill();
  }
}

function face(g, facing, ts, y) {
  if (facing === 'up') return;
  g.fillStyle = '#3a2a22';
  if (facing === 'down') {
    g.beginPath(); g.arc(-ts * .075, y, ts * .026, 0, Math.PI * 2); g.arc(ts * .075, y, ts * .026, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(240,140,130,.45)';
    g.beginPath(); g.arc(-ts * .12, y + ts * .06, ts * .03, 0, Math.PI * 2); g.arc(ts * .12, y + ts * .06, ts * .03, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.arc(facing === 'left' ? -ts * .09 : ts * .09, y, ts * .026, 0, Math.PI * 2); g.fill();
  }
}

function hair(g, style, color, facing, ts) {
  g.fillStyle = color;
  if (facing === 'up') { g.beginPath(); g.arc(0, -ts * .62, ts * .215, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.arc(0, -ts * .66, ts * .215, Math.PI * 1.02, Math.PI * 1.98); g.fill(); }
  if (style === 'bun' || style === 'topknot' || style === 'elder') {
    g.beginPath(); g.arc(0, -ts * .86, ts * .08, 0, Math.PI * 2); g.fill();
    if (style !== 'bun') { g.fillStyle = '#c9a45c'; g.fillRect(-ts * .1, -ts * .87, ts * .2, ts * .025); }
  } else if (style === 'twin') {
    g.beginPath(); g.arc(-ts * .17, -ts * .78, ts * .07, 0, Math.PI * 2); g.arc(ts * .17, -ts * .78, ts * .07, 0, Math.PI * 2); g.fill();
  }
}

// 人形角色（同門與主角共用）：長袍、腰帶、頭髮樣式。原點在腳下中央。
export function drawRobed(g, look, facing, ts, step = 0) {
  g.fillStyle = '#4a3c30';
  g.beginPath(); g.ellipse(-ts * .08, -ts * .03 + step * ts * .02, ts * .06, ts * .035, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(ts * .08, -ts * .03 - step * ts * .02, ts * .06, ts * .035, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = look.robe;
  g.beginPath(); g.moveTo(-ts * .13, -ts * .4); g.lineTo(ts * .13, -ts * .4); g.lineTo(ts * .21, -ts * .04); g.lineTo(-ts * .21, -ts * .04); g.closePath(); g.fill();
  g.fillStyle = look.trim;
  g.fillRect(-ts * .16, -ts * .24, ts * .32, ts * .045);
  if (facing !== 'up') { g.beginPath(); g.moveTo(-ts * .06, -ts * .4); g.lineTo(0, -ts * .3); g.lineTo(ts * .06, -ts * .4); g.lineWidth = ts * .025; g.strokeStyle = look.trim; g.stroke(); }
  g.fillStyle = '#f4d5b8'; g.beginPath(); g.arc(0, -ts * .6, ts * .2, 0, Math.PI * 2); g.fill();
  hair(g, look.style, look.hair, facing, ts);
  face(g, facing, ts, -ts * .57);
  if (look.style === 'elder' && facing !== 'up') {
    g.fillStyle = '#eeeae4';
    g.beginPath(); g.moveTo(-ts * .08, -ts * .47); g.quadraticCurveTo(0, -ts * .28, ts * .08, -ts * .47); g.closePath(); g.fill();
  }
}

// 主角的道袍外觀：沿用 3 種衣服配色。
export function playerLook(outfit) {
  return { robe: outfit.shirt, trim: outfit.trim, hair: '#3b2a24', style: 'topknot' };
}

export function drawCloud(g, px, py, ts) {
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath();
  g.ellipse(px, py, ts * .22, ts * .08, 0, 0, Math.PI * 2);
  g.ellipse(px + ts * .12, py - ts * .05, ts * .12, ts * .07, 0, 0, Math.PI * 2);
  g.ellipse(px - ts * .1, py - ts * .03, ts * .1, ts * .06, 0, 0, Math.PI * 2);
  g.fill();
}
