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
  shadow(g, cx + ts * .06, by, ts * .44);
  // 落葉
  g.fillStyle = 'rgba(120,150,80,.45)';
  for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + (hash2(x, y, 70 + k) - .5) * ts * .7, by - ts * .02, ts * .05, ts * .018, hash2(x, y, 80 + k) * 3, 0, Math.PI * 2); g.fill(); }
  [[-.18, 1.1, '#6aa863'], [.03, 1.5 + v * .2, '#5c9b57'], [.2, 1.0, '#74b36b']].forEach(([dx, h, col]) => {
    const sx = cx + dx * ts, top = by - h * ts;
    g.fillStyle = col; roundRect(g, sx - ts * .045, top, ts * .09, h * ts, ts * .04); g.fill();
    g.fillStyle = 'rgba(30,70,30,.25)'; g.fillRect(sx + ts * .01, top, ts * .035, h * ts);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(sx - ts * .035, top, ts * .015, h * ts);
    g.fillStyle = '#477d44';
    for (let k = 1; k < 5; k++) roundRect(g, sx - ts * .055, top + h * ts * k / 5, ts * .11, ts * .025, ts * .01), g.fill();
    // 竹葉成簇
    for (const [lx, ly, rot, len] of [[.13, .06, -.55, .16], [.2, .14, -.25, .13], [-.13, .2, .55, .15], [-.2, .28, .3, .12], [.12, .42, -.4, .14], [-.1, .55, .5, .12]]) {
      if (ly > h - .25) continue;
      g.save(); g.translate(sx + lx * ts * .6, top + ly * ts); g.rotate(rot);
      g.fillStyle = '#5aa25a'; g.beginPath(); g.ellipse(lx > 0 ? ts * len / 2 : -ts * len / 2, 0, ts * len / 2, ts * .03, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#86c47a'; g.beginPath(); g.ellipse(lx > 0 ? ts * len / 2 : -ts * len / 2, -ts * .006, ts * len / 2.4, ts * .012, 0, 0, Math.PI * 2); g.fill();
      g.restore();
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
  shadow(g, x + w / 2 + ts * .1, y + h - ts * .02, w * .62);
  // 石台階與台基
  g.fillStyle = '#c9c4b8'; roundRect(g, x + ts * .05, y + h - ts * .16, w - ts * .1, ts * .16, ts * .04); g.fill();
  g.fillStyle = '#b3ad9f'; roundRect(g, x + w / 2 - ts * .4, y + h - ts * .06, ts * .8, ts * .1, ts * .03); g.fill();
  // 牆與紅柱
  g.fillStyle = '#efe8d8'; roundRect(g, x + ts * .2, y + ts * .5, w - ts * .4, h - ts * .64, ts * .05); g.fill();
  g.fillStyle = '#e2d8c2'; g.fillRect(x + ts * .2, y + h - ts * .3, w - ts * .4, ts * .14);
  for (const px of [x + ts * .24, x + w - ts * .38]) {
    g.fillStyle = '#b2423a'; g.fillRect(px, y + ts * .55, ts * .14, h - ts * .7);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(px + ts * .02, y + ts * .55, ts * .03, h - ts * .7);
  }
  // 窗格（雕花）
  for (const wx of [x + ts * .48, x + w - ts * .9]) {
    g.fillStyle = '#7b5a40'; roundRect(g, wx, y + ts * .82, ts * .42, ts * .42, ts * .04); g.fill();
    g.fillStyle = '#f3e9cf'; g.fillRect(wx + ts * .04, y + ts * .86, ts * .34, ts * .34);
    g.strokeStyle = '#7b5a40'; g.lineWidth = Math.max(1, ts * .025);
    g.beginPath();
    for (let k = 1; k < 4; k++) { g.moveTo(wx + ts * .04 + k * ts * .085, y + ts * .86); g.lineTo(wx + ts * .04 + k * ts * .085, y + ts * 1.2); g.moveTo(wx + ts * .04, y + ts * .86 + k * ts * .085); g.lineTo(wx + ts * .38, y + ts * .86 + k * ts * .085); }
    g.stroke();
  }
  // 屋頂：深灰瓦、瓦壟直紋、兩端上翹、屋脊與脊飾
  const roof = () => {
    g.beginPath();
    g.moveTo(x - ts * .3, y + ts * .3);
    g.quadraticCurveTo(x + ts * .15, y + ts * .55, x + ts * .35, y + ts * .12);
    g.lineTo(x + w - ts * .35, y + ts * .12);
    g.quadraticCurveTo(x + w - ts * .15, y + ts * .55, x + w + ts * .3, y + ts * .3);
    g.lineTo(x + w + ts * .05, y + ts * .62); g.lineTo(x - ts * .05, y + ts * .62); g.closePath();
  };
  g.fillStyle = '#4f5d6a'; roof(); g.fill();
  g.save(); roof(); g.clip();
  g.strokeStyle = 'rgba(25,35,45,.35)'; g.lineWidth = Math.max(1, ts * .03);
  for (let k = 0; k < 14; k++) { const xx = x - ts * .2 + k * (w + ts * .4) / 13; g.beginPath(); g.moveTo(xx, y + ts * .1); g.lineTo(xx, y + ts * .65); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - ts * .3, y + ts * .1, w + ts * .6, ts * .12);
  g.restore();
  g.fillStyle = '#3d4955'; g.fillRect(x - ts * .06, y + ts * .58, w + ts * .12, ts * .07);
  g.fillStyle = '#6b7a88'; roundRect(g, x + ts * .3, y + ts * .02, w - ts * .6, ts * .13, ts * .05); g.fill();
  g.strokeStyle = '#6b7a88'; g.lineWidth = ts * .06; g.lineCap = 'round';
  for (const [sx, dir] of [[x + ts * .32, -1], [x + w - ts * .32, 1]]) { g.beginPath(); g.moveTo(sx, y + ts * .08); g.quadraticCurveTo(sx + dir * ts * .12, y - ts * .02, sx + dir * ts * .06, y - ts * .12); g.stroke(); }
  // 月洞門
  g.fillStyle = '#d8cfba'; g.beginPath(); g.arc(x + w / 2, y + h - ts * .42, ts * .36, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f2b29'; g.beginPath(); g.arc(x + w / 2, y + h - ts * .42, ts * .3, Math.PI, 0); g.fillRect(x + w / 2 - ts * .3, y + h - ts * .42, ts * .6, ts * .26); g.fill();
  // 匾額
  g.fillStyle = '#2f3b44'; roundRect(g, x + w / 2 - ts * .34, y + ts * .64, ts * .68, ts * .2, ts * .03); g.fill();
  g.strokeStyle = '#c9a45c'; g.lineWidth = Math.max(1, ts * .02); roundRect(g, x + w / 2 - ts * .31, y + ts * .665, ts * .62, ts * .15, ts * .02); g.stroke();
  g.fillStyle = '#e8c56a'; g.fillRect(x + w / 2 - ts * .18, y + ts * .725, ts * .36, ts * .03);
  // 紅燈籠
  for (const lx of [x + ts * .4, x + w - ts * .4]) {
    g.strokeStyle = '#3d4955'; g.lineWidth = Math.max(1, ts * .015); g.beginPath(); g.moveTo(lx, y + ts * .62); g.lineTo(lx, y + ts * .72); g.stroke();
    g.fillStyle = 'rgba(255,190,110,.3)'; g.beginPath(); g.arc(lx, y + ts * .82, ts * .14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d4483b'; g.beginPath(); g.ellipse(lx, y + ts * .82, ts * .08, ts * .1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c56a'; g.fillRect(lx - ts * .05, y + ts * .71, ts * .1, ts * .02); g.fillRect(lx - ts * .05, y + ts * .91, ts * .1, ts * .02);
  }
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
  // 鞋
  g.fillStyle = '#3e3229';
  g.beginPath(); g.ellipse(-ts * .08, -ts * .03 + step * ts * .02, ts * .06, ts * .035, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(ts * .08, -ts * .03 - step * ts * .02, ts * .06, ts * .035, 0, 0, Math.PI * 2); g.fill();
  // 寬袖（在身體後面）
  g.fillStyle = look.robe;
  g.beginPath(); g.ellipse(-ts * .19, -ts * .24 - step * ts * .015, ts * .08, ts * .12, .35, 0, Math.PI * 2); g.ellipse(ts * .19, -ts * .24 + step * ts * .015, ts * .08, ts * .12, -.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,.08)';
  g.beginPath(); g.ellipse(-ts * .2, -ts * .19, ts * .06, ts * .06, .35, 0, Math.PI * 2); g.ellipse(ts * .2, -ts * .19, ts * .06, ts * .06, -.35, 0, Math.PI * 2); g.fill();
  // 長袍：上窄下寬，下襬略深
  g.fillStyle = look.robe;
  g.beginPath(); g.moveTo(-ts * .13, -ts * .4); g.lineTo(ts * .13, -ts * .4); g.lineTo(ts * .21, -ts * .04); g.quadraticCurveTo(0, 0, -ts * .21, -ts * .04); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.1)';
  g.beginPath(); g.moveTo(-ts * .19, -ts * .12); g.lineTo(ts * .19, -ts * .12); g.lineTo(ts * .21, -ts * .04); g.quadraticCurveTo(0, 0, -ts * .21, -ts * .04); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(-ts * .1, -ts * .38); g.lineTo(-ts * .04, -ts * .38); g.lineTo(-ts * .08, -ts * .06); g.lineTo(-ts * .15, -ts * .06); g.closePath(); g.fill();
  // 腰帶與流蘇
  g.fillStyle = look.trim;
  g.fillRect(-ts * .16, -ts * .25, ts * .32, ts * .05);
  g.fillRect(ts * .04, -ts * .22, ts * .025, ts * .1);
  if (facing !== 'up') {
    // 白色內襟與交領
    g.fillStyle = '#fbf7ee'; g.beginPath(); g.moveTo(-ts * .07, -ts * .4); g.lineTo(0, -ts * .29); g.lineTo(ts * .07, -ts * .4); g.closePath(); g.fill();
    g.strokeStyle = look.trim; g.lineWidth = ts * .025;
    g.beginPath(); g.moveTo(-ts * .08, -ts * .41); g.lineTo(ts * .02, -ts * .27); g.moveTo(ts * .08, -ts * .41); g.lineTo(0, -ts * .31); g.stroke();
  }
  // 頭
  g.fillStyle = '#f4d5b8'; g.beginPath(); g.arc(0, -ts * .6, ts * .2, 0, Math.PI * 2); g.fill();
  hair(g, look.style, look.hair, facing, ts);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-ts * .07, -ts * .76, ts * .07, ts * .025, -.4, 0, Math.PI * 2); g.fill();
  face(g, facing, ts, -ts * .57);
  if (look.style === 'elder' && facing !== 'up') {
    g.fillStyle = '#eeeae4';
    g.beginPath(); g.moveTo(-ts * .09, -ts * .48); g.quadraticCurveTo(0, -ts * .25, ts * .09, -ts * .48); g.closePath(); g.fill();
    g.strokeStyle = '#eeeae4'; g.lineWidth = ts * .02; g.beginPath(); g.moveTo(-ts * .1, -ts * .64); g.lineTo(-ts * .03, -ts * .62); g.moveTo(ts * .1, -ts * .64); g.lineTo(ts * .03, -ts * .62); g.stroke();
  }
}

// 主角的道袍外觀：沿用 3 種衣服配色。
export function playerLook(outfit) {
  return { robe: outfit.shirt, trim: outfit.trim, hair: '#3b2a24', style: 'topknot' };
}

export function drawCloud(g, px, py, ts) {
  // 兩層雲：底層帶淡藍陰影，上層白亮。
  const puff = (dx, dy, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(px + dx, py + dy, ts * .28, ts * .09, 0, 0, Math.PI * 2);
    g.ellipse(px + dx + ts * .14, py + dy - ts * .06, ts * .14, ts * .08, 0, 0, Math.PI * 2);
    g.ellipse(px + dx - ts * .12, py + dy - ts * .04, ts * .12, ts * .07, 0, 0, Math.PI * 2);
    g.fill();
  };
  puff(ts * .02, ts * .03, 'rgba(170,190,215,.5)');
  puff(0, 0, 'rgba(255,255,255,.96)');
}
