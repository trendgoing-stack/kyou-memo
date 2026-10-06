// メモリ上の状態と変更通知。永続化は storage.js 経由。
import * as storage from './storage.js';

export const state = storage.loadAll();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn());
}

/** localStorage から最新を読み直す（複数ウィンドウ対策） */
export function reload() {
  Object.assign(state, storage.loadAll());
}

/** 指定キーを保存して通知する */
export function save(...names) {
  for (const n of names) storage.write(n, state[n]);
  notify();
}
