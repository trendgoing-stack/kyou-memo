// Service Worker：アプリ本体をキャッシュファーストで返す。
// VERSION を上げるとキャッシュ名が変わり、更新として検出される（js/version.js と同じ値にする）。
const VERSION = '1.1.0';
const CACHE = `dailytodo-cache-v${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './config.js',
  './count.js',
  './css/base.css',
  './css/components.css',
  './js/analytics.js',
  './js/backup.js',
  './js/date.js',
  './js/debug.js',
  './js/history.js',
  './js/main.js',
  './js/reorder.js',
  './js/rollover.js',
  './js/router.js',
  './js/routines.js',
  './js/storage.js',
  './js/store.js',
  './js/sw-register.js',
  './js/tasks.js',
  './js/version.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/sheet.js',
  './js/ui/tabbar.js',
  './js/ui/toast.js',
  './js/views/history.js',
  './js/views/routines.js',
  './js/views/settings.js',
  './js/views/today.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // HTTP キャッシュを避けて、常に最新のファイルを取り込む
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dailytodo-cache-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // 同一オリジンの GET だけを扱う。アクセス解析など外部への送信は介入せずそのまま通す
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ?debug=1 などのクエリ付きでも同じファイルを返す
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === 'navigate') {
          const fallback = await cache.match('./index.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    }),
  );
});
