import { state, subscribe, reload, notify } from './store.js';
import * as storage from './storage.js';
import { runRollover } from './rollover.js';
import { startRouter } from './router.js';
import { mountTabbar } from './ui/tabbar.js';
import { showToast } from './ui/toast.js';
import { msUntilMidnight, setDateOverride } from './date.js';
import { isDebug } from './debug.js';
import { startAnalytics } from './analytics.js';
import { registerServiceWorker } from './sw-register.js';
import * as today from './views/today.js';
import * as routines from './views/routines.js';
import * as history from './views/history.js';
import * as settings from './views/settings.js';

storage.setErrorHandler(() => showToast('保存できませんでした（端末の空き容量や設定を確認してください）'));

function applySettings() {
  document.documentElement.dataset.font = state.settings.fontSize === 'large' ? 'large' : 'normal';
}
subscribe(applySettings);

// キーボード表示中は下部タブバーを隠す
document.addEventListener('focusin', (e) => {
  if (e.target.matches('input, textarea')) document.body.classList.add('kbd');
});
document.addEventListener('focusout', () => document.body.classList.remove('kbd'));

// 日付の変更検知（起動時・復帰時・0:00）
function check() {
  runRollover();
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
window.addEventListener('pageshow', check);
window.addEventListener('focus', check);

let midnightTimer = null;
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    check();
    scheduleMidnight();
  }, msUntilMidnight() + 1000);
}

// 他のウィンドウでの変更を反映
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('dailytodo:')) {
    reload();
    notify();
  }
});

if (isDebug) setDateOverride(storage.readRaw('debugDate'));
applySettings();
runRollover();
scheduleMidnight();

const setActive = mountTabbar(document.getElementById('tabbar'));
startRouter(
  document.getElementById('view'),
  {
    today,
    routines,
    history,
    settings,
  },
  setActive,
);

startAnalytics();
registerServiceWorker();
