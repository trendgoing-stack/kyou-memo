// 定型タスクのロジック
import { state, save } from './store.js';
import { newId } from './rollover.js';
import { showToast } from './ui/toast.js';

export const MAX_ROUTINES = 30;
export const MAX_TITLE = 100;

/** 表示順（月〜日）に対応する曜日番号（日曜=0） */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABELS = { 0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' };

export function describeDays(days) {
  const set = new Set(days);
  if (set.size === 7) return '毎日';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return '平日';
  if (set.size === 2 && set.has(0) && set.has(6)) return '週末';
  return WEEK_ORDER.filter((d) => set.has(d)).map((d) => DAY_LABELS[d]).join('・');
}

export function sortedRoutines() {
  return [...state.routines].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

/** 追加（id なし）または更新。成功なら true */
export function saveRoutine({ id, title, days, time, enabled = true }) {
  const t = title.trim().slice(0, MAX_TITLE);
  if (!t || days.length === 0) return false;
  const clean = { title: t, days: [...new Set(days)].sort(), time: time || '', enabled };
  if (id) {
    const r = state.routines.find((x) => x.id === id);
    if (!r) return false;
    Object.assign(r, clean);
  } else {
    if (state.routines.length >= MAX_ROUTINES) {
      showToast(`定型タスクは${MAX_ROUTINES}件までです`);
      return false;
    }
    state.routines.push({ id: newId(), ...clean });
  }
  save('routines');
  return true;
}

export function toggleRoutine(id) {
  const r = state.routines.find((x) => x.id === id);
  if (!r) return;
  r.enabled = !r.enabled;
  save('routines');
}

export function deleteRoutine(id) {
  state.routines = state.routines.filter((x) => x.id !== id);
  save('routines');
}
