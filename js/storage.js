// localStorage への読み書きはこのモジュールだけで行う。
// キーはアプリ名と連動させない（表示名を変えてもデータを引き継ぐため）。

const PREFIX = 'dailytodo:';
export const SCHEMA_VERSION = 1;

const DEFAULTS = {
  meta: { schemaVersion: SCHEMA_VERSION, lastActiveDate: null },
  tasks: [],
  leftovers: [],
  routines: [],
  history: {},
  settings: { fontSize: 'normal', showDone: true, noAnalytics: false },
};

export const KEYS = Object.keys(DEFAULTS);

let errorHandler = () => {};
export function setErrorHandler(fn) {
  errorHandler = fn;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

export function read(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (raw == null) return clone(DEFAULTS[name]);
    const value = JSON.parse(raw);
    if (name === 'settings') return { ...DEFAULTS.settings, ...value };
    if (name === 'meta') return { ...DEFAULTS.meta, ...value };
    return value;
  } catch {
    return clone(DEFAULTS[name]);
  }
}

/** 成功したら true。容量超過などで失敗したら通知して false */
export function write(name, value) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(value));
    return true;
  } catch (e) {
    errorHandler(e);
    return false;
  }
}

export function loadAll() {
  const all = {};
  for (const k of KEYS) all[k] = read(k);
  return all;
}

/** 補助キー（debug 用の日付上書きなど）。エクスポート対象外 */
export function readRaw(name) {
  try {
    return localStorage.getItem(PREFIX + name);
  } catch {
    return null;
  }
}
export function writeRaw(name, value) {
  try {
    if (value == null) localStorage.removeItem(PREFIX + name);
    else localStorage.setItem(PREFIX + name, value);
    return true;
  } catch (e) {
    errorHandler(e);
    return false;
  }
}

/** 全削除（dailytodo: で始まるキーのみ） */
export function removeAll() {
  try {
    const targets = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) targets.push(k);
    }
    targets.forEach((k) => localStorage.removeItem(k));
    return true;
  } catch (e) {
    errorHandler(e);
    return false;
  }
}
