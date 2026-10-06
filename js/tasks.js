// タスク操作のロジック（画面からはここ経由で状態を変える）
import { state, save } from './store.js';
import { getToday } from './date.js';
import { newId } from './rollover.js';
import { showToast } from './ui/toast.js';

export const MAX_TASKS = 100;
export const MAX_TITLE = 100;

export const incomplete = () => state.tasks.filter((t) => !t.done).sort((a, b) => a.order - b.order);
export const completed = () =>
  state.tasks.filter((t) => t.done).sort((a, b) => (a.doneAt || '').localeCompare(b.doneAt || ''));
export const sortedLeftovers = () =>
  [...state.leftovers].sort((a, b) => a.originDate.localeCompare(b.originDate) || a.order - b.order);

const maxOrder = () => state.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);

function renumber(list) {
  list.forEach((t, i) => {
    t.order = i + 1;
  });
}

function checkCapacity() {
  if (state.tasks.length >= MAX_TASKS) {
    showToast(`1日のタスクは${MAX_TASKS}件までです`);
    return false;
  }
  return true;
}

export function addTask(rawTitle) {
  const title = rawTitle.trim().slice(0, MAX_TITLE);
  if (!title) return false;
  if (!checkCapacity()) return false;
  state.tasks.push({
    id: newId(),
    title,
    done: false,
    doneAt: null,
    order: maxOrder() + 1,
    time: '',
    memo: '',
    createdAt: new Date().toISOString(),
    originDate: getToday(),
  });
  save('tasks');
  return true;
}

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null; // order は変えない
  save('tasks');
}

export function updateTask(id, patch) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  save('tasks');
}

export function deleteTask(id) {
  const idx = state.tasks.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const task = state.tasks[idx];
  const pos = incomplete().findIndex((t) => t.id === id);
  state.tasks.splice(idx, 1);
  save('tasks');
  showToast('削除しました', { actionLabel: '元に戻す', onAction: () => restoreTask(task, pos) });
}

function restoreTask(task, pos) {
  if (state.tasks.some((t) => t.id === task.id)) return;
  if (state.tasks.length >= MAX_TASKS) return showToast(`1日のタスクは${MAX_TASKS}件までです`);
  if (task.done) {
    state.tasks.push(task);
  } else {
    const list = incomplete();
    list.splice(Math.min(pos, list.length), 0, task);
    state.tasks.push(task);
    renumber(list);
  }
  save('tasks');
}

/* ---------- 昨日の残り ---------- */

function takeLeftover(id) {
  const idx = state.leftovers.findIndex((x) => x.id === id);
  return idx < 0 ? null : state.leftovers.splice(idx, 1)[0];
}

export function moveToToday(id) {
  if (!checkCapacity()) return;
  const t = takeLeftover(id);
  if (!t) return;
  state.tasks.push({ ...t, done: false, doneAt: null, order: maxOrder() + 1 });
  save('tasks', 'leftovers');
}

export function moveAllToToday() {
  let moved = 0;
  for (const l of sortedLeftovers()) {
    if (state.tasks.length >= MAX_TASKS) break;
    const t = takeLeftover(l.id);
    state.tasks.push({ ...t, done: false, doneAt: null, order: maxOrder() + 1 });
    moved++;
  }
  save('tasks', 'leftovers');
  if (state.leftovers.length > 0) showToast(`1日のタスクは${MAX_TASKS}件までです`);
  return moved;
}

export function discardLeftover(id) {
  const t = takeLeftover(id);
  if (!t) return;
  save('leftovers');
  showToast('捨てました', {
    actionLabel: '元に戻す',
    onAction: () => {
      state.leftovers.push(t);
      save('leftovers');
    },
  });
}

export function discardAllLeftovers() {
  const all = state.leftovers;
  if (all.length === 0) return;
  state.leftovers = [];
  save('leftovers');
  showToast(`${all.length}件を捨てました`, {
    actionLabel: '元に戻す',
    onAction: () => {
      state.leftovers.push(...all);
      save('leftovers');
    },
  });
}

/* ---------- 並べ替え ---------- */

/** 未完了タスクの並びを ids の順に確定し、order を 1 から振り直す */
export function applyOrder(ids) {
  const list = incomplete();
  const byId = new Map(list.map((t) => [t.id, t]));
  const ordered = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
  const seen = new Set(ordered.map((t) => t.id));
  renumber([...ordered, ...list.filter((t) => !seen.has(t.id))]);
  save('tasks');
}

/** delta=-1 で上へ、+1 で下へ（未完了のみ） */
export function moveTask(id, delta) {
  const ids = incomplete().map((t) => t.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  applyOrder(ids);
}

/** 未完了を時刻の昇順（時刻なしは末尾、同順位は現在の並びを保つ）に整列 */
export function sortByTime() {
  const list = incomplete();
  const before = list.map((t) => t.id);
  const sorted = list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const ta = a.t.time || '99:99';
      const tb = b.t.time || '99:99';
      return ta < tb ? -1 : ta > tb ? 1 : a.i - b.i;
    })
    .map(({ t }) => t.id);
  applyOrder(sorted);
  showToast('時刻順に並べ替えました', { actionLabel: '元に戻す', onAction: () => applyOrder(before) });
}
