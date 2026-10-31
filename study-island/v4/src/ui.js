// DOM 介面：HUD、提示、對話框、背包／任務／建造抽屜。遊戲世界本身畫在 canvas，不在這裡。
import { MATERIALS, count, furnitureList, furnitureById } from './inventory.js';
import { RECIPES, missing } from './crafting.js';
import { QUESTS, questStatus } from './quests.js';
import { NPCS, npcById, friendshipLabel } from './npc/dialogue.js';
import { collectedCount, spotTotal } from './collectibles.js';
import { OUTFITS } from './state.js';
import { drawPortrait } from './render.js';
import { FOCUS_OPTIONS, STUDY_TASKS, focusRemaining, focusDoneToday, studyDoneToday, formatMs } from './learning.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const matName = id => (MATERIALS.find(m => m.id === id) || { name: id }).name;
const matIcon = id => (MATERIALS.find(m => m.id === id) || { icon: '' }).icon;
const rewardText = r => Object.entries(r).map(([id, n]) => matIcon(id) + matName(id) + '×' + n).join('、');

export function seasonLabel(d = new Date()) {
  const m = d.getMonth() + 1, h = d.getHours();
  const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  const icon = h >= 6 && h < 17 ? '🌤' : h >= 17 && h < 19 ? '🌇' : '🌙';
  return icon + ' ' + season + '日';
}

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
    $('islandName').textContent = save.islandName;
    $('shellCount').textContent = count(save.inventory, 'shell');
    $('clock').textContent = seasonLabel();
    focusTick(save);
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
    $('dlgName').textContent = npc.name;
    $('dlgSubject').innerHTML = '・' + esc(npc.subject) + ' <span class="hearts" title="親密度：' + friendshipLabel(friendship) + '">' + hearts(friendship) + '</span>';
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
    panelOpener = document.querySelector('.dock [data-panel="' + name + '"]');
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
      $('drawerTitle').textContent = '🎒 背包';
      const mats = MATERIALS.map(m => '<div class="slot"><span class="ic">' + m.icon + '</span><b>' + esc(m.name) + ' ×' + count(save.inventory, m.id) + '</b><small>在' + esc(m.where) + '撿</small></div>').join('');
      const furn = furnitureList(save.inventory).map(f => row(f.icon, esc(f.name) + ' ×' + f.qty, esc(f.note))).join('') ||
        '<p class="note">背包裡沒有家具。到「建造」的工坊可以製作。</p>';
      const friends = NPCS.map(n => {
        const fr = (save.npc[n.id] || {}).friendship || 0;
        return row('🐾', esc(n.name) + ' <span class="hearts">' + hearts(fr) + '</span>', esc(n.subject) + '・' + friendshipLabel(fr));
      }).join('');
      const outfits = OUTFITS.map(o =>
        '<button type="button" class="outfit" data-act="outfit" data-id="' + o.id + '" aria-pressed="' + (save.player.outfit === o.id) + '"><i style="background:' + o.shirt + '"></i>' + esc(o.name) + '</button>').join('');
      body.innerHTML = '<h3>材料</h3><div class="grid">' + mats + '</div><h3>家具</h3>' + furn +
        '<h3>居民親密度</h3>' + friends +
        '<h3>衣服顏色</h3><div class="outfits">' + outfits + '</div>' +
        '<p class="note">' + (persistent ? '背包存在這台裝置的瀏覽器（IndexedDB），重新整理不會消失；不同網址、裝置或瀏覽器不會互通。'
          : '⚠ 這個瀏覽器目前無法儲存，背包只存在本頁，關閉或重新整理就會消失。') + '</p>';
    } else if (panel === 'tasks') {
      $('drawerTitle').textContent = '📒 今日委託';
      const quests = QUESTS.map(q => {
        const st = questStatus(save, q, date), giver = npcById(q.giver);
        const right = st.claimed ? '<span class="done">已領取 ✓</span>'
          : '<button type="button" class="btn small" data-act="claim" data-id="' + q.id + '"' + (st.done ? '' : ' disabled') + '>' + (st.done ? '領取' : st.progress + '／' + q.target) + '</button>';
        return row(q.icon, esc(q.title), esc(giver.name) + '的委託・獎勵 ' + rewardText(q.reward), right);
      }).join('');
      const left = focusRemaining(save);
      const focus = left !== null
        ? '<div class="focus-run"><p class="timer" id="focusTimer">' + formatMs(left) + '</p><p class="note" style="margin:0">專注 ' + save.focus.minutes +
          ' 分鐘進行中。可以離開去讀書，時間依裝置時鐘計算，重新整理也會接續。</p>' +
          '<button type="button" class="btn small secondary" data-act="focusCancel">取消（不給獎勵）</button></div>'
        : FOCUS_OPTIONS.map(o => {
          const n = focusDoneToday(save, o.minutes, date), capped = n >= o.dailyCap;
          return row('⏱', '專注 ' + o.minutes + ' 分鐘', (capped ? '今天的獎勵已達上限（' + o.dailyCap + ' 次），仍可專注' : '今天 ' + n + '／' + o.dailyCap + '・獎勵 ' + rewardText(o.reward) + '、阿棕親密度 +1'),
            '<button type="button" class="btn small" data-act="focus" data-id="' + o.minutes + '">開始</button>');
        }).join('');
      const study = STUDY_TASKS.map(t => {
        const done = studyDoneToday(save, t.id, date), giver = npcById(t.npc);
        const right = done ? '<span class="done">已回報 ✓</span>'
          : confirming === t.id
            ? '<span class="confirm"><button type="button" class="btn small" data-act="studyConfirm" data-id="' + t.id + '">確定完成</button><button type="button" class="btn small secondary" data-act="studyCancel">取消</button></span>'
            : '<button type="button" class="btn small secondary" data-act="study" data-id="' + t.id + '">我完成了</button>';
        return row(t.icon, esc(t.title) + ' <span class="self">自行回報</span>',
          '獎勵 ' + rewardText(t.reward) + '、' + esc(giver.name) + '親密度 +1・<a href="' + t.link.href + '">' + esc(t.link.label) + '</a>', right);
      }).join('');
      const gather = MATERIALS.map(m => matIcon(m.id) + ' ' + collectedCount(save, date, m.id) + '／' + spotTotal(m.id)).join('　');
      body.innerHTML = '<h3>島上委託</h3>' + quests +
        '<h3>專注計時</h3>' + focus +
        '<h3>學習任務</h3>' + study +
        '<p class="note">「自行回報」：小島不會讀取你的作答或訂正紀錄，也不判斷內容，只依你的確認給獎勵；每項每天一次。休息不會扣任何東西。</p>' +
        '<h3>今天採集</h3><p class="note" style="margin-top:0">' + gather + '（每天依這台裝置的日期重新出現）</p>' +
        '<p class="note">每項委託每天只能領一次。不讀書也能在島上玩。</p>' +
        '<p class="note"><a href="../../">回觀護人學習平臺</a></p>';
    } else if (panel === 'build') {
      $('drawerTitle').textContent = '🔨 工坊與擺放';
      const recipes = RECIPES.map(r => {
        const f = furnitureById(r.makes), lack = missing(save.inventory, r);
        const need = Object.entries(r.needs).map(([id, n]) => {
          const have = count(save.inventory, id);
          return '<span class="' + (have < n ? 'lack' : '') + '">' + matIcon(id) + matName(id) + ' ' + have + '/' + n + '</span>';
        }).join('');
        return '<div class="row recipe"><span class="ic">' + f.icon + '</span><p><b>' + esc(f.name) + '</b><span class="need">' + need + '</span></p>' +
          '<button type="button" class="btn small" data-act="craft" data-id="' + r.id + '"' + (lack.length ? ' disabled aria-label="' + esc(f.name) + '：材料不足"' : '') + '>製作</button></div>';
      }).join('');
      const inBag = furnitureList(save.inventory).map(f => row(f.icon, esc(f.name) + ' ×' + f.qty, '點「擺放」後選一塊空地',
        '<button type="button" class="btn small" data-act="place" data-id="' + f.id + '">擺放</button>')).join('') ||
        '<p class="note">背包裡沒有家具。</p>';
      const placed = (save.placed || []).map(p => {
        const f = furnitureById(p.id);
        return row(f.icon, esc(f.name), '位置 (' + p.x + ', ' + p.y + ')', '<button type="button" class="btn small secondary" data-act="pickup" data-id="' + p.uid + '">收回</button>');
      }).join('') || '<p class="note">島上還沒有擺任何家具。</p>';
      body.innerHTML = '<h3>工坊</h3>' + recipes + '<h3>背包裡的家具</h3>' + inBag + '<h3>島上的家具</h3>' + placed +
        '<p class="note">家具不能擋住小路、採集點或居民，也不能把路堵死；靠近家具按 E 也可以收回。</p>';
    }
  }

  function placeBar(text) {
    $('placeBar').hidden = !text;
    $('placeText').textContent = text || '';
  }

  return {
    toast, banner, hud, placeBar, focusTick,
    showDialogue, advanceDialogue, closeDialogue,
    openPanel, closePanel, renderPanel,
    get dialogueOpen() { return !!dlg; },
    get panel() { return panel; }
  };
}
