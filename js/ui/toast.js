import { h } from './dom.js';

let timer = null;

/** トースト表示。actionLabel があれば操作ボタン（既定 5 秒）を付ける */
export function showToast(message, { actionLabel, onAction, duration = 5000 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  hideToast();
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, message));
  if (actionLabel) {
    el.append(
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            hideToast();
            onAction && onAction();
          },
        },
        actionLabel,
      ),
    );
  }
  root.append(el);
  timer = setTimeout(hideToast, actionLabel ? duration : Math.min(duration, 3500));
}

export function hideToast() {
  clearTimeout(timer);
  const root = document.getElementById('toast-root');
  if (root) root.replaceChildren();
}
