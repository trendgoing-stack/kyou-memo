// 振り返り用の集計。タスクの中身は保存せず、日ごとの総数と完了数のみ扱う。
import { state } from './store.js';
import { getToday, addDays } from './date.js';

export const DAYS = 30;

/** 直近30日（今日含む）の記録を新しい順に。今日はリアルタイム値。記録のない日は含めない */
export function getRecords() {
  const today = getToday();
  const oldest = addDays(today, -(DAYS - 1));
  const rows = Object.entries(state.history)
    .filter(([d]) => d >= oldest && d < today)
    .map(([date, r]) => ({ date, total: r.total, done: r.done }));
  if (state.tasks.length > 0) {
    rows.push({ date: today, total: state.tasks.length, done: state.tasks.filter((t) => t.done).length });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** 直近 days 日の完了数合計・総数・完了率(%)。総数 0 のとき rate は null */
export function summarize(records, days) {
  const from = addDays(getToday(), -(days - 1));
  const sel = records.filter((r) => r.date >= from);
  const done = sel.reduce((s, r) => s + r.done, 0);
  const total = sel.reduce((s, r) => s + r.total, 0);
  return { done, total, rate: total ? Math.round((done / total) * 100) : null };
}
