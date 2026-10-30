// DOM 介面：HUD、提示、對話框、背包／任務／建造抽屜。遊戲世界本身畫在 canvas，不在這裡。
import { MATERIALS, OPEN_MATERIALS, count, furnitureList } from './inventory.js';
import { OUTFITS } from './state.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function seasonLabel(d = new Date()) {
  const m = d.getMonth() + 1, h = d.getHours();
  const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  const icon = h >= 6 && h < 17 ? '🌤' : h >= 17 && h < 19 ? '🌇' : '🌙';
  return icon + ' ' + season + '日';
}

export function createUI() {
  let toastTimer = 0, dlg = null, panel = null, panelOpener = null;

  function toast(msg, ms = 2200) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function banner(msg) {
    const el = $('saveBanner');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function hud(save) {
    $('islandName').textContent = save.islandName;
    $('shellCount').textContent = count(save.inventory, 'shell');
    $('clock').textContent = seasonLabel();
  }

  // 對話：一次顯示一行，按「繼續」或 E／Enter 前進，最後一行後關閉。
  function showDialogue(npc, lines, onClose) {
    dlg = { lines, i: 0, onClose };
    $('dlgName').textContent = npc.name;
    $('dlgSubject').textContent = '・' + npc.subject;
    $('dialogue').hidden = false;
    renderLine();
    $('dlgNext').focus({ preventScroll: true });
  }
  function renderLine() {
    $('dlgText').textContent = dlg.lines[dlg.i];
    $('dlgNext').textContent = dlg.i < dlg.lines.length - 1 ? '繼續 ▸' : '再見 ✓';
  }
  function advanceDialogue() {
    if (!dlg) return;
    if (dlg.i < dlg.lines.length - 1) { dlg.i++; renderLine(); return; }
    closeDialogue();
  }
  function closeDialogue() {
    if (!dlg) return;
    const cb = dlg.onClose;
    dlg = null;
    $('dialogue').hidden = true;
    if (cb) cb();
  }
  $('dlgNext').addEventListener('click', advanceDialogue);

  function openPanel(name, ctx) {
    panel = name;
    panelOpener = document.querySelector('.dock [data-panel="' + name + '"]');
    document.querySelectorAll('.dock [data-panel]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.panel === name)));
    renderPanel(ctx);
    $('drawer').hidden = false;
    $('drawerClose').focus({ preventScroll: true });
  }
  function closePanel() {
    if (!panel) return;
    panel = null;
    $('drawer').hidden = true;
    document.querySelectorAll('.dock [data-panel]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (panelOpener) panelOpener.focus({ preventScroll: true });
  }
  $('drawerClose').addEventListener('click', closePanel);

  function renderPanel({ save, shellsToday, shellsTotal, talkedToday, persistent, onOutfit }) {
    const body = $('drawerBody');
    if (panel === 'bag') {
      $('drawerTitle').textContent = '🎒 背包';
      const mats = MATERIALS.map(m => {
        const open = OPEN_MATERIALS.has(m.id);
        return '<div class="slot' + (open ? '' : ' locked') + '"><span class="ic">' + m.icon + '</span><b>' + esc(m.name) + ' ×' + count(save.inventory, m.id) + '</b><small>' +
          (open ? '在' + esc(m.where) + '撿' : '之後開放') + '</small></div>';
      }).join('');
      const furn = furnitureList(save.inventory).map(f =>
        '<div class="row"><span class="ic">' + f.icon + '</span><p><b>' + esc(f.name) + ' ×' + f.qty + '</b><small>' + esc(f.note) + '</small></p></div>').join('') ||
        '<p class="note">目前沒有家具。</p>';
      const outfits = OUTFITS.map(o =>
        '<button type="button" class="outfit" data-outfit="' + o.id + '" aria-pressed="' + (save.player.outfit === o.id) + '"><i style="background:' + o.shirt + '"></i>' + esc(o.name) + '</button>').join('');
      body.innerHTML = '<h3>材料</h3><div class="grid">' + mats + '</div><h3>家具</h3>' + furn +
        '<h3>衣服顏色</h3><div class="outfits">' + outfits + '</div>' +
        '<p class="note">' + (persistent ? '背包存在這台裝置的瀏覽器（IndexedDB），重新整理不會消失；不同網址、裝置或瀏覽器不會互通。'
          : '⚠ 這個瀏覽器目前無法儲存，背包只存在本頁，關閉或重新整理就會消失。') + '</p>';
      body.querySelectorAll('[data-outfit]').forEach(b => b.addEventListener('click', () => onOutfit(b.dataset.outfit)));
    } else if (panel === 'tasks') {
      $('drawerTitle').textContent = '📒 今日委託';
      const row = (ic, title, sub, done) => '<div class="row"><span class="ic">' + ic + '</span><p><b>' + title + '</b><small>' + sub + '</small></p>' +
        (done ? '<span class="done">完成 ✓</span>' : '') + '</div>';
      body.innerHTML =
        row('🐚', '在沙灘撿貝殼 ' + shellsToday + '／' + shellsTotal, '貝殼每天依這台裝置的日期重新出現。', shellsToday >= shellsTotal) +
        row('🦊', '和栗子打招呼', '栗子在廣場東邊散步。', talkedToday) +
        '<p class="note">這是可玩 Demo A：只有遊戲內委託。專注、申論、訂正等學習任務會在之後的階段加入，而且一律標示「自行回報」；不讀書也能在島上玩。</p>' +
        '<p class="note"><a href="../../">回觀護人學習平臺</a></p>';
    } else if (panel === 'build') {
      $('drawerTitle').textContent = '🔨 建造';
      body.innerHTML = '<p>工坊製作與家具擺放會在下一階段（B：經營循環）開放。</p>' +
        furnitureList(save.inventory).map(f => '<div class="row"><span class="ic">' + f.icon + '</span><p><b>' + esc(f.name) + ' ×' + f.qty + '</b><small>已在背包裡等你擺放。</small></p></div>').join('');
    }
  }

  return {
    toast, banner, hud,
    showDialogue, advanceDialogue, closeDialogue,
    openPanel, closePanel, renderPanel,
    get dialogueOpen() { return !!dlg; },
    get panel() { return panel; }
  };
}
