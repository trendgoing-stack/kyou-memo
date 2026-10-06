// 振り返り用の集計と、過去の日の修正。
// 日ごとに総数・完了数と、直近30日分のタスク（id・タイトル・完了状態）を保存する。
import { state, save } from './store.js';
import { getToday, addDays } from './date.js';
import { newId } from './rollover.js';
import { showToast } from './ui/toast.js';

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

/* ---------- 過去の日の修正 ---------- */

const MAX_TASKS = 100;
const MAX_TITLE = 100;

/** タスク一覧から総数・完了数を再計算して保存。タスクが 0 件になった日は記録ごと消す */
function commit(date) {
  const d = state.history[date];
  if (d) {
    d.total = d.tasks.length;
    d.done = d.tasks.filter((t) => t.done).length;
    if (d.total === 0) delete state.history[date];
  }
  save('history');
}

export function togglePast(date, id) {
  const t = state.history[date]?.tasks?.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  commit(date);
}

export function renamePast(date, id, rawTitle) {
  const t = state.history[date]?.tasks?.find((x) => x.id === id);
  const title = rawTitle.trim().slice(0, MAX_TITLE);
  if (!t || !title) return false;
  t.title = title;
  commit(date);
  return true;
}

export function addPast(date, rawTitle) {
  const title = rawTitle.trim().slice(0, MAX_TITLE);
  if (!title) return false;
  const d = state.history[date] || (state.history[date] = { total: 0, done: 0, tasks: [] });
  if (!d.tasks) return false; // 内容が保存されていない日は追加できない
  if (d.tasks.length >= MAX_TASKS) {
    showToast(`1日のタスクは${MAX_TASKS}件までです`);
    return false;
  }
  d.tasks.push({ id: newId(), title, done: false });
  commit(date);
  return true;
}

export function deletePast(date, id) {
  const d = state.history[date];
  const idx = d && d.tasks ? d.tasks.findIndex((x) => x.id === id) : -1;
  if (idx < 0) return;
  const [task] = d.tasks.splice(idx, 1);
  commit(date);
  showToast('削除しました', {
    actionLabel: '元に戻す',
    onAction: () => {
      const day = state.history[date] || (state.history[date] = { total: 0, done: 0, tasks: [] });
      day.tasks.splice(Math.min(idx, day.tasks.length), 0, task);
      commit(date);
    },
  });
}
