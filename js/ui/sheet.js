import { h } from './dom.js';

let current = null;

function lockBody() {
  const y = window.scrollY;
  document.body.dataset.scrollY = String(y);
  document.body.style.top = `-${y}px`;
  document.body.classList.add('scroll-locked');
}

function unlockBody() {
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  const y = Number(document.body.dataset.scrollY || 0);
  delete document.body.dataset.scrollY;
  window.scrollTo(0, y);
}

/** ボトムシートを開く。build(close) が本文要素を返す */
export function openSheet(title, build) {
  closeSheet();
  const backdrop = h('div', { class: 'backdrop' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const onKey = (e) => e.key === 'Escape' && close();
  function close() {
    if (current !== close) return;
    current = null;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    sheet.remove();
    unlockBody();
  }
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  sheet.append(h('h2', null, title), build(close));
  lockBody();
  document.body.append(backdrop, sheet);
  current = close;
  return close;
}

export function closeSheet() {
  if (current) current();
}
