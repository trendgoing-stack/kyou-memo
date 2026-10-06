// 日付まわり。「今日」は端末のローカル時刻で判定する（toISOString は使わない）。

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

let override = null; // テスト用の上書き（?debug=1 のときだけ main.js が設定）

export function setDateOverride(value) {
  override = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今日の日付取得はここ 1 か所に集約する */
export function getToday() {
  return override || formatDate(new Date());
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

/** 0=日曜 … 6=土曜 */
export function dayOfWeek(str) {
  return parseDate(str).getDay();
}

/** 例：10月6日（火） */
export function formatLong(str) {
  const d = parseDate(str);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 例：10/4 */
export function formatShort(str) {
  const d = parseDate(str);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next - now;
}
