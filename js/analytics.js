// アクセス解析（GoatCounter）。送るのは起動時の 1 回のみ、パスは固定値。
// ハッシュやタスクの内容は送らない。失敗しても何も表示しない。
import { GOATCOUNTER_CODE } from '../config.js';
import { state } from './store.js';
import { isDebug } from './debug.js';
import * as storage from './storage.js';

const FIXED_PATH = '/app-start';

export function startAnalytics() {
  try {
    if (!GOATCOUNTER_CODE) return;
    if (state.settings.noAnalytics) return; // オフなら count.js も読み込まない
    if (isDebug || storage.readRaw('debugDate')) return; // 日付上書き中は送らない
    window.goatcounter = {
      endpoint: `https://${GOATCOUNTER_CODE}.goatcounter.com/count`,
      no_onload: true,
    };
    const s = document.createElement('script');
    s.async = true;
    s.src = './count.js';
    s.onload = () => {
      try {
        window.goatcounter.count({ path: FIXED_PATH, title: '今日メモ', referrer: '' });
      } catch {
        /* 無視 */
      }
    };
    s.onerror = () => {};
    document.head.append(s);
  } catch {
    /* 無視 */
  }
}
