// DOM 介面：HUD、提示、對話框、背包／任務／建造抽屜。遊戲世界本身畫在 canvas，不在這裡。
import { MATERIALS, count, furnitureList, furnitureById } from './inventory.js';
import { RECIPES, missing } from './crafting.js';
import { QUESTS, questStatus } from './quests.js';
import { NPCS, npcById, friendshipLabel } from './npc/dialogue.js';
import { collectedCount, spotTotal } from './collectibles.js';
import { OUTFITS } from './state.js';
import { drawPortrait } from './render.js';
import { V1_GOODS, V1_FIXED, V1_HEARTS, legacySummary } from './migration.js';
import { THEME_LIST, theme, w, mat, furn, npcName, npcRole, studyTitle, placeName } from './theme.js';
import { FOCUS_OPTIONS, STUDY_TASKS, focusRemaining, focusDoneToday, studyDoneToday, formatMs } from './learning.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const matName = id => mat(id).name;
const matIcon = id => mat(id).icon;
const fname = id => furn(id).name;
const ficon = id => furn(id).icon;
const who = id => (npcRole(id) ? npcRole(id) : '') + npcName(id);
const rewardText = r => Object.entries(r).map(([id, n]) => matIcon(id) + matName(id) + '×' + n).join('、');

export function seasonLabel(d = new Date()) {
  const m = d.getMonth() + 1, h = d.getHours();
  const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  const icon = h >= 6 && h < 17 ? '🌤' : h >= 17 && h < 19 ? '🌇' : '🌙';
  return icon + ' ' + season + '日';
}

// ISO 時間轉成裝置本地的「YYYY-MM-DD HH:MM」。
const localTime = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
};
// 島嶼主題沿用原本的委託名稱；修仙主題把材料名稱換成靈材。
const questTitle = q => q.title.replace('貝殼', matName('shell'));
const hearts = n => '♥'.repeat(Math.min(5, Math.ceil(n / 2))) + '♡'.repeat(5 - Math.min(5, Math.ceil(n / 2)));

export function createUI() {
  let toastTimer = 0, dlg = null, panel = null, panelOpener = null, handlers = {}, lastCtx = null, confirming = null;

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
    $('islandName').textContent = placeName(save);
    $('shellCount').textContent = count(save.inventory, 'shell');
    $('clock').textContent = seasonLabel();
    focusTick(save);
  }

  // 主題外框：底部按鈕、提示、標題、地圖說明與瀏覽器配色。
  function applyChrome() {
    const t = theme();
    document.documentElement.dataset.theme = t.id;
    for (const [panelId, key] of [['bag', 'bag'], ['tasks', 'tasks'], ['build', 'build']]) {
      const b = document.querySelector('.dock [data-panel="' + panelId + '"]');
      if (b) { b.firstChild.textContent = w(key + 'Icon'); b.querySelector('span').textContent = w(key); }
    }
    $('hint').textContent = w('hint');
    $('game').setAttribute('aria-label', (t.place || '小島') + w('mapLabel') + '。點擊地面移動，或用方向鍵／WASD 移動，靠近後按 E 互動。');
    document.title = '觀護學習島 v4｜' + (t.place || '小樹灣');
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = t.palette.themeColor;
    document.querySelector('.hud .island').firstChild.textContent = t.icon + ' ';
    $('focusChip').firstChild.textContent = w('focusIcon') + ' ';
    const shells = document.querySelector('.hud .shells');
    shells.firstChild.textContent = mat('shell').icon + ' ';
    shells.title = mat('shell').name;
  }

  // 專注倒數：HUD 小標籤與任務抽屜內的計時文字，每秒更新而不重繪整個抽屜。
  function focusTick(save) {
    const left = focusRemaining(save);
    const chip = $('focusChip');
    chip.hidden = left === null;
    document.querySelector('.hud').classList.toggle('focusing', left !== null);
    if (left !== null) chip.lastElementChild.textContent = formatMs(left);
    const t = document.getElementById('focusTimer');
    if (t && left !== null) t.textContent = formatMs(left);
  }

  // 對話：一次顯示一行，按「繼續」或 E／Enter 前進，最後一行後關閉。
  function showDialogue(npc, lines, onClose, friendship = 0) {
    dlg = { lines, i: 0, onClose };
    $('dlgName').textContent = who(npc.id);
    $('dlgSubject').innerHTML = '・' + esc(npc.subject) + ' <span class="hearts" title="' + w('friendship') + '：' + friendshipLabel(friendship) + '">' + hearts(friendship) + '</span>';
    $('dialogue').hidden = false;
    drawPortrait($('portrait'), npc);
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
    panelOpener = document.querySelector('.dock [data-panel="' + name + '"]') || document.querySelector('.dock [data-panel=bag]');
    document.querySelectorAll('.dock [data-panel]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.panel === name)));
    renderPanel(ctx);
    $('drawer').hidden = false;
    $('drawerClose').focus({ preventScroll: true });
  }
  function closePanel(restoreFocus = true) {
    if (!panel) return;
    panel = null;
    confirming = null;
    $('drawer').hidden = true;
    document.querySelectorAll('.dock [data-panel]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (restoreFocus && panelOpener) panelOpener.focus({ preventScroll: true });
  }
  $('drawerClose').addEventListener('click', () => closePanel());
  $('drawerBody').addEventListener('change', e => {
    const input = e.target.closest('input[type=file][data-act]');
    if (!input || !input.files || !input.files[0]) return;
    const fn = handlers[input.dataset.act];
    if (fn) fn(input.files[0]);
    input.value = '';
  });

  // 抽屜內的按鈕以事件委派處理，重新繪製內容不需要重綁。
  $('drawerBody').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    // 自行回報需要第二次確認，避免誤觸就領獎。
    if (b.dataset.act === 'study') { confirming = b.dataset.id; renderPanel(lastCtx); return; }
    if (b.dataset.act === 'studyCancel') { confirming = null; renderPanel(lastCtx); return; }
    if (b.dataset.act === 'studyConfirm') confirming = null;
    const fn = handlers[b.dataset.act];
    if (fn) fn(b.dataset.id);
  });

  function row(ic, title, sub, right = '') {
    return '<div class="row"><span class="ic">' + ic + '</span><p><b>' + title + '</b><small>' + sub + '</small></p>' + right + '</div>';
  }

  function renderPanel(ctx) {
    const { save, date, persistent } = ctx;
    lastCtx = ctx;
    handlers = ctx.handlers || {};
    const body = $('drawerBody');
    if (panel === 'bag') {
      $('drawerTitle').textContent = w('bagIcon') + ' ' + w('bag');
      const mats = MATERIALS.map(m => '<div class="slot"><span class="ic">' + matIcon(m.id) + '</span><b>' + esc(matName(m.id)) + ' ×' + count(save.inventory, m.id) + '</b><small>在' + esc(mat(m.id).where) + '撿</small></div>').join('');
      const furnRows = furnitureList(save.inventory).map(f => row(ficon(f.id), esc(fname(f.id)) + ' ×' + f.qty, esc(furn(f.id).note))).join('') ||
        '<p class="note">' + w('bag') + '裡沒有' + w('furniture') + '。到「' + w('build') + '」可以製作。</p>';
      const friends = NPCS.map(n => {
        const fr = (save.npc[n.id] || {}).friendship || 0;
        return row(theme().id === 'xianxia' ? '🧑' : '🐾', esc(who(n.id)) + ' <span class="hearts">' + hearts(fr) + '</span>', esc(n.subject) + '・' + friendshipLabel(fr));
      }).join('');
      const themes = THEME_LIST.map(t =>
        '<button type="button" class="outfit" data-act="theme" data-id="' + t.id + '" aria-pressed="' + (save.theme === t.id) + '">' + t.icon + ' ' + esc(t.label) + '</button>').join('');
      const outfits = OUTFITS.map(o =>
        '<button type="button" class="outfit" data-act="outfit" data-id="' + o.id + '" aria-pressed="' + (save.player.outfit === o.id) + '"><i style="background:' + o.shirt + '"></i>' + esc(o.name) + '</button>').join('');
      body.innerHTML = '<h3>材料</h3><div class="grid">' + mats + '</div><h3>' + w('furniture') + '</h3>' + furnRows +
        '<h3>' + w('residents') + w('friendship') + '</h3>' + friends +
        '<h3>' + w('outfit') + '</h3><div class="outfits">' + outfits + '</div>' +
        '<h3>外觀主題</h3><div class="outfits">' + themes + '</div>' +
        '<p class="note" style="margin-top:6px">切換主題只改變外觀和名稱，' + w('bag') + '、' + w('furniture') + '、任務與計時進度完全不變。</p>' +
        '<h3>資料</h3><button type="button" class="btn secondary" data-act="openData">💾 備份與' + w('legacy') + '</button>' +
        '<p class="note">' + (persistent ? w('bag') + '存在這台裝置的瀏覽器（IndexedDB），重新整理不會消失；不同網址、裝置或瀏覽器不會互通。'
          : '⚠ 這個瀏覽器目前無法儲存，' + w('bag') + '只存在本頁，關閉或重新整理就會消失。') + '</p>';
    } else if (panel === 'tasks') {
      $('drawerTitle').textContent = w('tasksIcon') + ' ' + w('tasksTitle');
      const quests = QUESTS.map(q => {
        const st = questStatus(save, q, date), giver = npcById(q.giver);
        const right = st.claimed ? '<span class="done">已領取 ✓</span>'
          : '<button type="button" class="btn small" data-act="claim" data-id="' + q.id + '"' + (st.done ? '' : ' disabled') + '>' + (st.done ? '領取' : st.progress + '／' + q.target) + '</button>';
        return row(q.icon, esc(questTitle(q)), esc(who(giver.id)) + w('questOf') + '・獎勵 ' + rewardText(q.reward), right);
      }).join('');
      const left = focusRemaining(save);
      const focus = left !== null
        ? '<div class="focus-run"><p class="timer" id="focusTimer">' + formatMs(left) + '</p><p class="note" style="margin:0">' + w('focus') + ' ' + save.focus.minutes +
          ' 分鐘進行中。可以離開去讀書，時間依裝置時鐘計算，重新整理也會接續。</p>' +
          '<button type="button" class="btn small secondary" data-act="focusCancel">取消（不給獎勵）</button></div>'
        : FOCUS_OPTIONS.map(o => {
          const n = focusDoneToday(save, o.minutes, date), capped = n >= o.dailyCap;
          return row(w('focusIcon'), w('focus') + ' ' + o.minutes + ' 分鐘', (capped ? '今天的獎勵已達上限（' + o.dailyCap + ' 次），仍可' + w('focus') : '今天 ' + n + '／' + o.dailyCap + '・獎勵 ' + rewardText(o.reward) + '、' + who(o.npc) + w('friendship') + ' +1'),
            '<button type="button" class="btn small" data-act="focus" data-id="' + o.minutes + '">開始</button>');
        }).join('');
      const study = STUDY_TASKS.map(t => {
        const done = studyDoneToday(save, t.id, date), giver = npcById(t.npc);
        const right = done ? '<span class="done">已回報 ✓</span>'
          : confirming === t.id
            ? '<span class="confirm"><button type="button" class="btn small" data-act="studyConfirm" data-id="' + t.id + '">確定完成</button><button type="button" class="btn small secondary" data-act="studyCancel">取消</button></span>'
            : '<button type="button" class="btn small secondary" data-act="study" data-id="' + t.id + '">我完成了</button>';
        return row(t.icon, esc(studyTitle(t.id, t.title)) + ' <span class="self">自行回報</span>',
          '獎勵 ' + rewardText(t.reward) + '、' + esc(who(giver.id)) + w('friendship') + ' +1・<a href="' + t.link.href + '">' + esc(t.link.label) + '</a>', right);
      }).join('');
      const gather = MATERIALS.map(m => matIcon(m.id) + ' ' + collectedCount(save, date, m.id) + '／' + spotTotal(m.id)).join('　');
      body.innerHTML = '<h3>' + w('questGroup') + '</h3>' + quests +
        '<h3>' + w('focus') + '計時</h3>' + focus +
        '<h3>' + w('study') + '</h3>' + study +
        '<p class="note">「自行回報」：遊戲不會讀取你的作答或訂正紀錄，也不判斷內容，只依你的確認給獎勵；每項每天一次。休息不會扣任何東西。</p>' +
        '<h3>今天採集</h3><p class="note" style="margin-top:0">' + gather + '（每天依這台裝置的日期重新出現）</p>' +
        '<p class="note">每項任務每天只能領一次。' + w('noPlay') + '</p>' +
        '<p class="note"><a href="../../">回觀護人學習平臺</a></p>';
    } else if (panel === 'data') {
      $('drawerTitle').textContent = '💾 備份與' + w('legacy');
      body.innerHTML = renderData(ctx);
    } else if (panel === 'build') {
      $('drawerTitle').textContent = w('buildIcon') + ' ' + w('buildTitle');
      const recipes = RECIPES.map(r => {
        const f = furnitureById(r.makes), lack = missing(save.inventory, r);
        const need = Object.entries(r.needs).map(([id, n]) => {
          const have = count(save.inventory, id);
          return '<span class="' + (have < n ? 'lack' : '') + '">' + matIcon(id) + matName(id) + ' ' + have + '/' + n + '</span>';
        }).join('');
        return '<div class="row recipe"><span class="ic">' + ficon(f.id) + '</span><p><b>' + esc(fname(f.id)) + '</b><span class="need">' + need + '</span></p>' +
          '<button type="button" class="btn small" data-act="craft" data-id="' + r.id + '"' + (lack.length ? ' disabled aria-label="' + esc(fname(f.id)) + '：材料不足"' : '') + '>製作</button></div>';
      }).join('');
      const inBag = furnitureList(save.inventory).map(f => row(ficon(f.id), esc(fname(f.id)) + ' ×' + f.qty, '點「擺放」後選一塊空地',
        '<button type="button" class="btn small" data-act="place" data-id="' + f.id + '">擺放</button>')).join('') ||
        '<p class="note">' + w('bag') + '裡沒有' + w('furniture') + '。</p>';
      const placed = (save.placed || []).map(p => {
        const f = furnitureById(p.id);
        return row(ficon(f.id), esc(fname(f.id)), '位置 (' + p.x + ', ' + p.y + ')', '<button type="button" class="btn small secondary" data-act="pickup" data-id="' + p.uid + '">收回</button>');
      }).join('') || '<p class="note">' + w('place') + '還沒有擺任何' + w('furniture') + '。</p>';
      body.innerHTML = '<h3>' + w('workshop') + '</h3>' + recipes + '<h3>' + w('bag') + '裡的' + w('furniture') + '</h3>' + inBag + '<h3>' + w('placedGroup') + '</h3>' + placed +
        '<p class="note">' + w('furniture') + '不能擋住' + theme().terrain.path + '、採集點或' + w('residents') + '，也不能把路堵死；靠近按 E 也可以收回。</p>';
    }
  }

  function legacyPreview(sum, title, okLabel, okAct, warn) {
    return '<div class="preview"><b>' + title + '</b><ul>' +
      '<li>島名：' + esc(sum.islandName) + '</li>' +
      '<li>舊島貝殼：' + sum.shells + '</li>' +
      '<li>花園裡的裝飾：' + sum.placed + ' 件；待整理倉庫：' + sum.stored + ' 件' + (sum.conflicts ? '（其中 ' + sum.conflicts + ' 件原本的位置放不進花園）' : '') + '</li>' +
      '<li>居民親密度：' + esc(sum.hearts.join('、')) + '</li>' +
      '<li>學習天數：' + sum.days + '；徽章：' + (sum.badges.length ? esc(sum.badges.join(' ')) : '尚無') + '</li></ul>' +
      (warn ? '<p class="note">' + warn + '</p>' : '') +
      '<div class="confirm"><button type="button" class="btn small" data-act="' + okAct + '">' + okLabel + '</button>' +
      '<button type="button" class="btn small secondary" data-act="cancelImport">取消</button></div></div>';
  }

  function renderData({ save, pending, v1Local }) {
    let html = '';
    if (pending && pending.kind === 'v1') {
      html += legacyPreview(legacySummary(pending.legacy), '預覽：v3 小島資料（' + (pending.legacy.source === 'local' ? '這個網址的 v3 存檔' : '匯入的檔案') + '）',
        '確定轉入舊島花園', 'confirmImport', '轉入只會新增「舊島花園」，不影響目前的小島；v3 原資料不會被修改或刪除。居民親密度取兩邊較高者（v4 上限 10）。');
    } else if (pending && pending.kind === 'v4') {
      const sm = pending.summary;
      html += '<div class="preview"><b>預覽：v4 小島備份</b><ul>' +
        '<li>島名：' + esc(sm.islandName) + '；最後更新：' + esc(localTime(sm.updatedAt)) + '</li>' +
        '<li>材料：' + MATERIALS.map(m => matIcon(m.id) + (sm.materials[m.id] || 0)).join(' ') + '</li>' +
        '<li>背包家具 ' + sm.furniture + ' 件；島上家具 ' + sm.placed + ' 件；' + (sm.legacy ? '含舊島花園' : '不含舊島花園') + '</li></ul>' +
        '<p class="note">⚠ 匯入會<b>取代</b>這個瀏覽器目前的 v4 小島。建議先按下面的「匯出備份」留一份。</p>' +
        '<div class="confirm"><button type="button" class="btn small" data-act="confirmImport">確定取代</button>' +
        '<button type="button" class="btn small secondary" data-act="cancelImport">取消</button></div></div>';
    }
    html += '<h3>' + w('legacy') + '（v3）</h3>';
    const l = save.legacy;
    if (l) {
      const cells = l.garden.map((id, i) => {
        const g = V1_GOODS[id];
        return '<span class="cell' + (V1_FIXED[i] ? ' fixed' : '') + '" title="' + (g ? esc(g.name) : '') + '">' + (V1_FIXED[i] || (g ? g.icon : '')) + '</span>';
      }).join('');
      const store = Object.entries(l.storage).map(([id, n]) => (V1_GOODS[id] ? V1_GOODS[id].icon + esc(V1_GOODS[id].name) : '❓' + esc(id)) + ' ×' + n).join('、') || '空的';
      const hearts = Object.keys(V1_HEARTS).map(k => esc(npcName(V1_HEARTS[k])) + ' ' + (l.hearts[k] || 0)).join('、');
      html += '<p class="note" style="margin-top:0">「' + esc(l.islandName) + '」的花園，保留 v3 時的擺設（唯讀展示）。轉入時間 ' + esc(localTime(l.importedAt)) + '。</p>' +
        '<div class="garden" role="img" aria-label="舊島花園 6×6 擺設">' + cells + '</div>' +
        row('📦', '待整理倉庫', store) +
        row('🐚', '舊島貝殼 ' + l.shells, '保留在舊島紀錄中；不會加進 v4 的製作材料。') +
        row('💗', 'v3 親密度', hearts) +
        row('🏅', '徽章', (l.badges.length ? esc(l.badges.join(' ')) : '尚無') + '・學習天數 ' + l.days.length);
    } else if (v1Local && !(pending && pending.kind === 'v1')) {
      html += '<p class="note" style="margin-top:0">在這個網址找到 v3 小島「' + esc(v1Local.islandName) + '」。</p>' +
        '<button type="button" class="btn secondary" data-act="previewLocal">預覽並轉入舊島花園</button>';
    } else if (!pending) {
      html += '<p class="note" style="margin-top:0">這個網址沒有 v3 小島資料。若 v3 在其他網址（例如另一個測試站），請在 v3 頁面按「匯出小島 JSON」，再用下面的「匯入 JSON」選那個檔案。不同網址的瀏覽器資料無法自動互通。</p>';
    }
    html += '<h3>備份</h3>' +
      '<div class="confirm" style="justify-content:flex-start"><button type="button" class="btn small" data-act="exportBackup">匯出備份</button>' +
      '<label class="btn small secondary file-btn">匯入 JSON<input class="sr-only" type="file" accept=".json,application/json" data-act="importFile"></label></div>' +
      '<p class="note">匯入可選 v4 備份或 v3 匯出的 JSON，都會先顯示預覽，確認後才寫入；取消不會改動任何資料。備份只含小島，不含考古題答案或其他學習紀錄。</p>';
    return html;
  }

  function placeBar(text) {
    $('placeBar').hidden = !text;
    $('placeText').textContent = text || '';
  }

  return {
    toast, banner, hud, placeBar, focusTick, applyChrome,
    showDialogue, advanceDialogue, closeDialogue,
    openPanel, closePanel, renderPanel,
    get dialogueOpen() { return !!dlg; },
    get panel() { return panel; }
  };
}
