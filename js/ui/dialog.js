import { h } from './dom.js';

/** 確認ダイアログ。OK なら true を返す Promise */
export function confirmDialog(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    const backdrop = h('div', { class: 'backdrop top' });
    const done = (v) => {
      backdrop.remove();
      dlg.remove();
      resolve(v);
    };
    const ok = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => done(true) }, okLabel);
    const dlg = h(
      'div',
      { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
      h('p', null, message),
      h(
        'div',
        { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => done(false) }, 'キャンセル'),
        ok,
      ),
    );
    backdrop.addEventListener('click', () => done(false));
    document.body.append(backdrop, dlg);
    ok.focus();
  });
}
