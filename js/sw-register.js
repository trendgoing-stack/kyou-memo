// Service Worker の登録と、更新の通知
import { h } from './ui/dom.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // 既存のワーカーがある状態で更新待ちのワーカーが現れたら通知する
      const offer = (worker) => {
        if (navigator.serviceWorker.controller) showBanner(worker);
      };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed') offer(w);
        });
      });
      // 復帰したときに更新を確認する
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}

function showBanner(worker) {
  if (document.getElementById('update-banner')) return;
  document.body.append(
    h('button', {
      id: 'update-banner',
      class: 'update-banner',
      type: 'button',
      onclick: () => worker.postMessage('SKIP_WAITING'),
    }, '更新があります（タップで再読み込み）'),
  );
}
