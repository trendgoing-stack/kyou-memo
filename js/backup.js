// エクスポート／インポート。検証に通らなければ何も変更しない。
import { state, save, reload } from './store.js';
import * as storage from './storage.js';
import { runRollover } from './rollover.js';
import { APP_VERSION } from './version.js';
import { MAX_TASKS } from './tasks.js';
import { MAX_ROUTINES } from './routines.js';

const APP_ID = 'dailytodo';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function buildExport() {
  const { meta, tasks, leftovers, routines, history, settings } = state;
  return JSON.stringify(
    {
      app: APP_ID,
      schemaVersion: storage.SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { meta, tasks, leftovers, routines, history, settings },
    },
    null,
    2,
  );
}

const fail = (msg) => {
  throw new Error(msg);
};

function checkTask(t, where) {
  if (!t || typeof t !== 'object') fail(`${where}の形式が不正です`);
  if (typeof t.id !== 'string' || !t.id) fail(`${where}の id が不正です`);
  if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 100) fail(`${where}のタイトルが不正です`);
  if (typeof t.done !== 'boolean') fail(`${where}の完了状態が不正です`);
  if (!Number.isFinite(t.order)) fail(`${where}の並び順が不正です`);
  const time = t.time || '';
  if (time && !TIME_RE.test(time)) fail(`${where}の時刻が不正です`);
  const memo = t.memo || '';
  if (typeof memo !== 'string' || memo.length > 500) fail(`${where}のメモが不正です`);
  if (!DATE_RE.test(t.originDate || '')) fail(`${where}の日付が不正です`);
  return {
    id: t.id,
    title: t.title,
    done: t.done,
    doneAt: t.doneAt || null,
    order: Math.round(t.order),
    time,
    memo,
    createdAt: String(t.createdAt || ''),
    originDate: t.originDate,
    ...(t.routineId ? { routineId: String(t.routineId) } : {}),
  };
}

function checkRoutine(r) {
  if (!r || typeof r !== 'object') fail('定型タスクの形式が不正です');
  if (typeof r.id !== 'string' || !r.id) fail('定型タスクの id が不正です');
  if (typeof r.title !== 'string' || !r.title.trim() || r.title.length > 100) fail('定型タスクのタイトルが不正です');
  if (!Array.isArray(r.days) || r.days.length === 0 || !r.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    fail('定型タスクの曜日が不正です');
  }
  const time = r.time || '';
  if (time && !TIME_RE.test(time)) fail('定型タスクの時刻が不正です');
  return { id: r.id, title: r.title, days: [...new Set(r.days)].sort(), time, enabled: r.enabled !== false };
}

/** JSON 文字列を検証して正規化したデータを返す。不正なら Error を投げる */
export function parseImport(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    fail('JSON として読み込めませんでした');
  }
  if (!obj || obj.app !== APP_ID || typeof obj.data !== 'object' || !obj.data) fail('このアプリのデータではありません');
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) fail('スキーマバージョンが不正です');
  if (obj.schemaVersion > storage.SCHEMA_VERSION) fail('新しいバージョンのデータです。アプリを更新してください');
  const d = obj.data;
  const arr = (v, name) => (Array.isArray(v) ? v : v == null ? [] : fail(`${name}の形式が不正です`));

  const tasks = arr(d.tasks, 'タスク').map((t) => checkTask(t, 'タスク'));
  const leftovers = arr(d.leftovers, '昨日の残り').map((t) => checkTask(t, '昨日の残り'));
  const routines = arr(d.routines, '定型タスク').map(checkRoutine);
  const history = {};
  if (d.history != null) {
    if (typeof d.history !== 'object' || Array.isArray(d.history)) fail('記録の形式が不正です');
    for (const [date, r] of Object.entries(d.history)) {
      if (!DATE_RE.test(date) || !r || typeof r !== 'object') fail('記録の内容が不正です');
      if (r.tasks != null) {
        if (!Array.isArray(r.tasks) || r.tasks.length > MAX_TASKS) fail('記録のタスクが不正です');
        const list = r.tasks.map((t) => {
          if (!t || typeof t.id !== 'string' || !t.id || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 100 || typeof t.done !== 'boolean') {
            fail('記録のタスクが不正です');
          }
          return { id: t.id, title: t.title, done: t.done };
        });
        history[date] = { total: list.length, done: list.filter((t) => t.done).length, tasks: list };
      } else {
        if (!Number.isInteger(r.total) || !Number.isInteger(r.done) || r.done < 0 || r.done > r.total) fail('記録の内容が不正です');
        history[date] = { total: r.total, done: r.done };
      }
    }
  }
  const lastActiveDate = d.meta && d.meta.lastActiveDate;
  if (lastActiveDate != null && !DATE_RE.test(lastActiveDate)) fail('最終アクティブ日が不正です');
  const s = d.settings && typeof d.settings === 'object' ? d.settings : {};
  const settings = {
    fontSize: s.fontSize === 'large' ? 'large' : 'normal',
    showDone: s.showDone !== false,
    noAnalytics: s.noAnalytics === true,
  };
  if (tasks.length > MAX_TASKS) fail(`タスクが${MAX_TASKS}件を超えています`);
  if (routines.length > MAX_ROUTINES) fail(`定型タスクが${MAX_ROUTINES}件を超えています`);
  return { tasks, leftovers, routines, history, settings, lastActiveDate: lastActiveDate || null };
}

const unionById = (current, incoming) => {
  const map = new Map(current.map((x) => [x.id, x]));
  incoming.forEach((x) => map.set(x.id, x));
  return [...map.values()];
};

/** 検証済みデータを適用する。mode: 'merge' | 'replace'。失敗時は Error */
export function applyImport(data, mode) {
  reload();
  let next;
  if (mode === 'replace') {
    next = {
      meta: { ...state.meta, lastActiveDate: data.lastActiveDate },
      tasks: data.tasks,
      leftovers: data.leftovers,
      routines: data.routines,
      history: data.history,
      settings: data.settings,
    };
  } else {
    const tasks = unionById(state.tasks, data.tasks);
    const routines = unionById(state.routines, data.routines);
    if (tasks.length > MAX_TASKS) fail(`統合するとタスクが${MAX_TASKS}件を超えるため、取り込めません`);
    if (routines.length > MAX_ROUTINES) fail(`統合すると定型タスクが${MAX_ROUTINES}件を超えるため、取り込めません`);
    tasks
      .filter((t) => !t.done)
      .sort((a, b) => a.order - b.order)
      .forEach((t, i) => {
        t.order = i + 1;
      });
    next = {
      meta: { ...state.meta, lastActiveDate: state.meta.lastActiveDate || data.lastActiveDate },
      tasks,
      leftovers: unionById(state.leftovers, data.leftovers),
      routines,
      history: { ...state.history, ...data.history },
      settings: state.settings,
    };
  }
  Object.assign(state, next);
  save('meta', 'tasks', 'leftovers', 'routines', 'history', 'settings');
  runRollover();
}
