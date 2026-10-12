/* 少年司法週報：v2.5 站內閱讀入口。GPL-3.0-only，依 repository LICENSE。 */
(() => {
  'use strict';
  const script = document.currentScript;
  if (!script || document.getElementById('jw-v25-entry')) return;
  const weeklyUrl = new URL('./', script.src).href;
  const nav = document.querySelector('.study-header nav');
  if (!nav) return;

  const entry = document.createElement('a');
  entry.id = 'jw-v25-entry';
  entry.href = weeklyUrl;
  entry.textContent = '少年司法週報';
  nav.append(entry);
  if (typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function') return;

  entry.setAttribute('aria-haspopup', 'dialog');
  const style = document.createElement('style');
  style.textContent = `
    #jw-v25-reader {width:calc(100vw - 28px);height:calc(100vh - 28px);
      height:calc(100dvh - 28px);max-width:none;max-height:none;
      border:1px solid #d9e2ec;border-radius:14px;padding:0;margin:auto;
      color:#102a43;background:#faf9f5;overflow:hidden;
      box-shadow:0 18px 70px rgba(16,42,67,.25)}
    #jw-v25-reader::backdrop {background:rgba(16,42,67,.55)}
    #jw-v25-reader .jw-reader-shell {height:100%;display:flex;flex-direction:column}
    #jw-v25-reader .jw-reader-head {display:flex;align-items:center;
      justify-content:space-between;gap:12px;flex-wrap:wrap;
      padding:10px 16px;background:#102a43;color:#fff}
    #jw-v25-reader .jw-reader-head h2 {font:700 16px/1.5 -apple-system,
      BlinkMacSystemFont,"Noto Sans TC",sans-serif;margin:0;color:#fff}
    #jw-v25-reader .jw-reader-actions {display:flex;gap:10px;align-items:center}
    #jw-v25-reader .jw-reader-actions a {color:#bddfd8;font-size:12px;
      text-decoration:none;padding:7px 3px}
    #jw-v25-reader .jw-reader-actions button {border:1px solid #486581;
      background:#243b53;color:#fff;border-radius:8px;cursor:pointer;
      min-height:38px;padding:7px 12px;font:600 13px/1.5 -apple-system,sans-serif}
    #jw-v25-reader iframe {display:block;width:100%;border:0;flex:1;min-height:0;
      background:#faf9f5}
    #jw-v25-reader :focus-visible {outline:3px solid #65d6d0;outline-offset:2px}
    @media(max-width:600px){#jw-v25-reader {width:100vw;height:100vh;height:100dvh;
      max-height:none;border-radius:0;border:0}
      #jw-v25-reader .jw-reader-head {padding:9px 12px}
      #jw-v25-reader .jw-reader-head h2 {font-size:14px}
      #jw-v25-reader .jw-reader-actions {gap:7px}}
  `;
  document.head.append(style);
  const reader = document.createElement('dialog');
  reader.id = 'jw-v25-reader';
  reader.setAttribute('aria-labelledby', 'jw-v25-title');
  const shell = document.createElement('div');
  shell.className = 'jw-reader-shell';
  const head = document.createElement('div');
  head.className = 'jw-reader-head';
  const title = document.createElement('h2');
  title.id = 'jw-v25-title';
  title.textContent = '少年司法週報';
  const actions = document.createElement('div');
  actions.className = 'jw-reader-actions';
  const standalone = document.createElement('a');
  standalone.href = weeklyUrl;
  standalone.target = '_blank';
  standalone.rel = 'noopener noreferrer';
  standalone.textContent = '獨立開啟 ↗';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '返回練習 ×';
  close.setAttribute('aria-label', '關閉週報並返回練習');
  close.addEventListener('click', () => reader.close());
  const frame = document.createElement('iframe');
  frame.title = '少年司法週報完整閱讀頁面';
  actions.append(standalone, close);
  head.append(title, actions);
  shell.append(head, frame);
  reader.append(shell);
  document.body.append(reader);
  let loaded = false;
  let previousOverflow = '';
  entry.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (reader.open) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!loaded) {frame.src = weeklyUrl; loaded = true;}
    reader.showModal();
  });
  reader.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    entry.focus();
  });
})();
