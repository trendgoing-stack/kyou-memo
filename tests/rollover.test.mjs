// 実行: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRollover } from '../js/rollover.js';

const task = (o) => ({ id: o.id, title: o.id, done: false, doneAt: null, order: 1, time: '', memo: '', createdAt: '', originDate: '2026-10-05', ...o });
const base = (o = {}) => ({
  meta: { schemaVersion: 1, lastActiveDate: '2026-10-05' },
  tasks: [], leftovers: [], routines: [], history: {}, settings: {},
  ...o,
});

test('同日・時計が戻った場合は何もしない', () => {
  assert.equal(computeRollover(base(), '2026-10-05'), null);
  assert.equal(computeRollover(base(), '2026-10-04'), null);
});

test('未完了は残りへ、完了は削除、記録を保存', () => {
  const s = base({ tasks: [task({ id: 'a' }), task({ id: 'b', done: true, doneAt: 'x' })] });
  const r = computeRollover(s, '2026-10-06');
  assert.deepEqual(r.leftovers.map((t) => t.id), ['a']);
  assert.equal(r.leftovers[0].originDate, '2026-10-05');
  assert.equal(r.tasks.length, 0);
  assert.deepEqual(r.history['2026-10-05'], { total: 2, done: 1 });
  assert.equal(r.meta.lastActiveDate, '2026-10-06');
});

test('数日空いても未完了は残りに集約し、既存の残りも保持', () => {
  const s = base({ leftovers: [task({ id: 'old', originDate: '2026-10-01' })], tasks: [task({ id: 'a' })] });
  const r = computeRollover(s, '2026-10-09');
  assert.deepEqual(r.leftovers.map((t) => t.id), ['old', 'a']);
});

test('定型：対象曜日のみ・先頭に時刻順・定型由来の未完了は破棄', () => {
  const routines = [
    { id: 'r1', title: 'none', days: [2], time: '', enabled: true },
    { id: 'r2', title: 'late', days: [2], time: '09:00', enabled: true },
    { id: 'r3', title: 'early', days: [2], time: '07:30', enabled: true },
    { id: 'r4', title: 'off', days: [2], time: '', enabled: false },
    { id: 'r5', title: 'wed', days: [3], time: '', enabled: true },
  ];
  const s = base({ routines, tasks: [task({ id: 'gen', routineId: 'r1' })] });
  const r = computeRollover(s, '2026-10-06'); // 火曜
  assert.deepEqual(r.tasks.map((t) => t.title), ['early', 'late', 'none']);
  assert.deepEqual(r.tasks.map((t) => t.order), [1, 2, 3]);
  assert.equal(r.leftovers.length, 0);
  assert.equal(computeRollover(r, '2026-10-06'), null); // 二重生成なし
});

test('30日より古い記録を削除', () => {
  const s = base({ history: { '2026-09-06': { total: 1, done: 1 }, '2026-09-07': { total: 1, done: 1 } } });
  const r = computeRollover(s, '2026-10-06');
  assert.deepEqual(Object.keys(r.history).sort(), ['2026-09-07']);
});
