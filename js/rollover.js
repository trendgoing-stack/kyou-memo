// 日付またぎ（ロールオーバー）。中心は副作用のない computeRollover。
import { state, reload, save } from './store.js';
import { getToday, addDays, dayOfWeek } from './date.js';

const HISTORY_DAYS = 30;

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const byTimeThenNone = (a, b) => {
  if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
  if (a.time) return -1;
  if (b.time) return 1;
  return 0;
};

/**
 * 与えた状態と今日の日付から、新しい状態を返す。実行不要なら null。
 * 入力は変更しない。
 */
export function computeRollover(s, today) {
  const last = s.meta.lastActiveDate;
  if (last && today <= last) return null; // 同日、または時計が戻された

  const next = JSON.parse(JSON.stringify(s));
  let tasks = next.tasks;

  if (last) {
    // 1. 前回アクティブだった日の記録
    if (tasks.length > 0) {
      next.history[last] = {
        total: tasks.length,
        done: tasks.filter((t) => t.done).length,
        // 過去の日を振り返りで修正できるよう、直近30日分はタイトルと完了状態も残す
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, done: t.done })),
      };
    }
    // 2,3. 未完了を「昨日の残り」へ（定型由来は破棄）。4. 完了済みは削除
    for (const t of tasks) {
      if (!t.done && !t.routineId) next.leftovers.push({ ...t, done: false, doneAt: null });
    }
    tasks = [];
    // 30日より古い記録を削除（今日を含む直近30日を残す）
    const oldest = addDays(today, -(HISTORY_DAYS - 1));
    for (const d of Object.keys(next.history)) {
      if (d < oldest) delete next.history[d];
    }
  }

  // 5. 今日の定型タスクを生成（先頭に、時刻昇順・時刻なしは末尾）
  const dow = dayOfWeek(today);
  const existing = new Set(tasks.filter((t) => t.routineId).map((t) => t.routineId));
  const generated = next.routines
    .filter((r) => r.enabled && r.days.includes(dow) && !existing.has(r.id))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => byTimeThenNone(a.r, b.r) || a.i - b.i)
    .map(({ r }) => r);

  const now = new Date().toISOString();
  const made = generated.map((r, i) => ({
    id: newId(),
    title: r.title,
    done: false,
    doneAt: null,
    order: i + 1,
    time: r.time || '',
    memo: '',
    createdAt: now,
    originDate: today,
    routineId: r.id,
  }));
  tasks.forEach((t) => {
    if (!t.done) t.order += made.length;
  });
  next.tasks = [...made, ...tasks];

  // 6. 最終アクティブ日を更新
  next.meta.lastActiveDate = today;
  return next;
}

/** localStorage を読み直してから実行し、変更があれば保存する */
export function runRollover() {
  reload();
  const result = computeRollover(state, getToday());
  if (!result) return false;
  Object.assign(state, result);
  save('meta', 'tasks', 'leftovers', 'history');
  return true;
}
