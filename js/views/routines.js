import { h } from '../ui/dom.js';
import { state, subscribe } from '../store.js';
import * as routines from '../routines.js';
import { openSheet } from '../ui/sheet.js';
import { confirmDialog } from '../ui/dialog.js';

export function mount(root) {
  const listBox = h('div');
  root.append(
    h('h1', { class: 'today-date' }, '定型'),
    h('p', { class: 'note' }, '対象の曜日になると、その日の最初に「今日」へ自動で追加されます。'),
    h('button', { class: 'btn btn-primary block', type: 'button', onclick: () => openEditor(null) }, '＋ 定型を追加'),
    listBox,
  );

  function render() {
    const list = routines.sortedRoutines();
    if (list.length === 0) return listBox.replaceChildren(h('div', { class: 'empty spaced' }, '定型タスクはまだありません'));
    listBox.replaceChildren(
      h('ul', { class: 'list spaced' }, list.map((r) =>
        h('li', { class: 'routine' + (r.enabled ? '' : ' off') },
          h('button', { class: 'routine-body', type: 'button', onclick: () => openEditor(r) },
            h('span', { class: 'task-title' }, r.title),
            h('span', { class: 'task-meta' }, [routines.describeDays(r.days), r.time || null].filter(Boolean).join('　'))),
          h('button', {
            class: 'switch',
            type: 'button',
            role: 'switch',
            'aria-checked': String(r.enabled),
            'aria-label': `「${r.title}」のオン／オフ`,
            onclick: () => routines.toggleRoutine(r.id),
          }, h('span', { class: 'switch-knob' })),
          h('button', {
            class: 'link-btn danger',
            type: 'button',
            'aria-label': `「${r.title}」を削除`,
            onclick: async () => {
              if (await confirmDialog(`「${r.title}」を削除しますか？\n（すでに生成された今日のタスクは残ります）`, '削除')) {
                routines.deleteRoutine(r.id);
              }
            },
          }, '削除')))),
    );
  }

  function openEditor(r) {
    openSheet(r ? '定型を編集' : '定型を追加', (close) => {
      const days = new Set(r ? r.days : []);
      const title = h('input', { type: 'text', value: r ? r.title : '', maxlength: String(routines.MAX_TITLE), autocomplete: 'off' });
      const time = h('input', { type: 'time', value: r ? r.time || '' : '' });
      const error = h('p', { class: 'field-error', hidden: true });
      const chips = new Map();
      const syncChips = () => chips.forEach((el, d) => el.setAttribute('aria-pressed', String(days.has(d))));
      const setDays = (list) => {
        days.clear();
        list.forEach((d) => days.add(d));
        syncChips();
      };
      for (const d of routines.WEEK_ORDER) {
        const chip = h('button', {
          class: 'chip',
          type: 'button',
          onclick: () => {
            days.has(d) ? days.delete(d) : days.add(d);
            syncChips();
          },
        }, routines.DAY_LABELS[d]);
        chips.set(d, chip);
      }
      syncChips();
      const shortcut = (label, list) => h('button', { class: 'link-btn', type: 'button', onclick: () => setDays(list) }, label);
      const save = () => {
        if (!title.value.trim()) {
          error.textContent = 'タイトルを入力してください';
          return (error.hidden = false);
        }
        if (days.size === 0) {
          error.textContent = '曜日を1つ以上選んでください';
          return (error.hidden = false);
        }
        if (routines.saveRoutine({ id: r && r.id, title: title.value, days: [...days], time: time.value, enabled: r ? r.enabled : true })) close();
      };
      return h('div', null,
        h('label', { class: 'field' }, h('span', null, 'タイトル'), title),
        h('div', { class: 'field' },
          h('span', null, '曜日'),
          h('div', { class: 'chips' }, [...chips.values()]),
          h('div', { class: 'shortcuts' },
            shortcut('毎日', [0, 1, 2, 3, 4, 5, 6]), shortcut('平日', [1, 2, 3, 4, 5]), shortcut('週末', [0, 6]))),
        h('label', { class: 'field' }, h('span', null, '時刻（任意）'), time),
        error,
        h('div', { class: 'sheet-actions' },
          h('button', { class: 'btn', type: 'button', onclick: close }, 'キャンセル'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, '保存')));
    });
  }

  render();
  return subscribe(render);
}
