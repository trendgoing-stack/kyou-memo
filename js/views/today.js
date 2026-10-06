import { h } from '../ui/dom.js';
import { state, subscribe } from '../store.js';
import * as tasks from '../tasks.js';
import { getToday, formatLong, formatShort } from '../date.js';
import { openSheet } from '../ui/sheet.js';
import { confirmDialog } from '../ui/dialog.js';
import { attachReorder, isDragging } from '../reorder.js';

export function mount(root) {
  let doneOpen = false; // 「折りたたむ」設定時に一時的に開いているか
  let pendingRender = false;

  const header = h('header', { class: 'today-header' });
  const input = h('input', {
    class: 'add-input',
    type: 'text',
    maxlength: String(tasks.MAX_TITLE),
    placeholder: 'やることを追加',
    enterkeyhint: 'enter',
    autocomplete: 'off',
    'aria-label': 'やることを追加',
  });
  const addBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, '追加');
  // ボタンのタップでキーボード（フォーカス）を失わない
  addBtn.addEventListener('pointerdown', (e) => e.preventDefault());
  const form = h('form', { class: 'add-form' }, input, addBtn);
  // form の submit を使うので、日本語入力の変換確定の Enter では送信されない
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (tasks.addTask(input.value)) input.value = '';
    input.focus();
  });
  const leftoversBox = h('div');
  const listBox = h('div');
  root.append(header, form, leftoversBox, listBox);

  function renderHeader() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.done).length;
    header.replaceChildren(
      h('h1', { class: 'today-date' }, formatLong(getToday())),
      h('p', { class: 'today-progress' }, `${done} / ${total} 完了`),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) },
        h('span', { style: `width:${total ? (done / total) * 100 : 0}%` })),
    );
  }

  function renderLeftovers() {
    const list = tasks.sortedLeftovers();
    if (list.length === 0) return leftoversBox.replaceChildren();
    leftoversBox.replaceChildren(
      h('section', { class: 'section' },
        h('div', { class: 'section-head' },
          h('h2', { class: 'section-title' }, `昨日の残り（${list.length}）`),
          h('div', { class: 'section-actions' },
            h('button', { class: 'link-btn', type: 'button', onclick: () => tasks.moveAllToToday() }, 'すべて今日に移す'),
            h('button', {
              class: 'link-btn danger',
              type: 'button',
              onclick: async () => {
                if (await confirmDialog(`昨日の残り ${state.leftovers.length} 件をすべて捨てますか？`, 'すべて捨てる')) {
                  tasks.discardAllLeftovers();
                }
              },
            }, 'すべて捨てる'))),
        h('ul', { class: 'list' }, list.map(leftoverRow))),
    );
  }

  function leftoverRow(t) {
    return h('li', { class: 'leftover' },
      h('div', { class: 'leftover-main' },
        h('span', { class: 'leftover-title' }, t.title),
        h('span', { class: 'leftover-from' }, `${formatShort(t.originDate)} から`)),
      h('div', { class: 'leftover-actions' },
        h('button', { class: 'link-btn', type: 'button', onclick: () => tasks.moveToToday(t.id) }, '今日に移す'),
        h('button', { class: 'link-btn danger', type: 'button', onclick: () => tasks.discardLeftover(t.id) }, '捨てる')));
  }

  function taskRow(t) {
    const meta = [
      t.time ? h('span', { class: 'meta-time' }, t.time) : null,
      t.routineId ? h('span', { class: 'meta-icon', role: 'img', 'aria-label': '定型タスク', title: '定型タスク' }, '↻') : null,
      t.memo ? h('span', { class: 'meta-icon', role: 'img', 'aria-label': 'メモあり', title: 'メモあり' }, '📝') : null,
    ].filter(Boolean);
    return h('li', { class: 'task' + (t.done ? ' done' : ''), 'data-id': t.id, 'data-sortable': t.done ? null : '' },
      h('button', {
        class: 'check',
        type: 'button',
        role: 'checkbox',
        'aria-checked': String(t.done),
        'aria-label': t.done ? `「${t.title}」を未完了に戻す` : `「${t.title}」を完了にする`,
        onclick: () => tasks.toggleTask(t.id),
      }, h('span', { class: 'checkmark', 'aria-hidden': 'true' }, '✓')),
      h('button', { class: 'task-body', type: 'button', onclick: () => openEdit(t.id) },
        h('span', { class: 'task-title' }, t.title),
        meta.length ? h('span', { class: 'task-meta' }, meta) : null),
      t.done ? null : h('button', { class: 'handle', type: 'button', 'aria-label': `「${t.title}」を並べ替え` }, '≡'));
  }

  function renderList() {
    const todo = tasks.incomplete();
    const done = tasks.completed();
    if (todo.length + done.length === 0) {
      return listBox.replaceChildren(h('div', { class: 'empty' }, '今日のタスクはまだありません'));
    }
    const collapsed = !state.settings.showDone;
    const showDoneRows = !collapsed || doneOpen;
    const ul = h('ul', { class: 'list' }, [...todo, ...(showDoneRows ? done : [])].map(taskRow));
    attachReorder(ul, {
      onCommit: tasks.applyOrder,
      onFinish: () => {
        if (pendingRender) renderAll();
      },
    });
    listBox.replaceChildren(
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, '今日のタスク'),
        h('button', { class: 'link-btn menu-btn', type: 'button', 'aria-label': 'リストのメニュー', onclick: openListMenu }, '⋯')),
      ul,
      collapsed && done.length
        ? h('button', { class: 'link-btn done-toggle', type: 'button', onclick: () => { doneOpen = !doneOpen; renderList(); } },
          doneOpen ? '完了済みを隠す' : `完了済み ${done.length} 件を表示`)
        : null,
    );
  }

  function openListMenu() {
    openSheet('リストの操作', (close) =>
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { close(); tasks.sortByTime(); } }, '時刻順に並べ替える')));
  }

  function openEdit(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    openSheet('タスクを編集', (close) => {
      const title = h('input', { type: 'text', value: t.title, maxlength: String(tasks.MAX_TITLE), autocomplete: 'off' });
      const time = h('input', { type: 'time', value: t.time || '' });
      const memo = h('textarea', { rows: '4', maxlength: '500' });
      memo.value = t.memo || '';
      const error = h('p', { class: 'field-error', hidden: true }, 'タイトルを入力してください');
      const save = () => {
        const v = title.value.trim();
        if (!v) return (error.hidden = false);
        tasks.updateTask(id, { title: v, time: time.value || '', memo: memo.value.slice(0, 500) });
        close();
      };

      let moveRow = null;
      if (!t.done) {
        const up = h('button', { class: 'btn', type: 'button', onclick: () => { tasks.moveTask(id, -1); refresh(); } }, '↑ 上へ');
        const down = h('button', { class: 'btn', type: 'button', onclick: () => { tasks.moveTask(id, 1); refresh(); } }, '↓ 下へ');
        const refresh = () => {
          const list = tasks.incomplete();
          const i = list.findIndex((x) => x.id === id);
          up.disabled = i <= 0;
          down.disabled = i < 0 || i >= list.length - 1;
        };
        refresh();
        moveRow = h('div', { class: 'sheet-actions move-row' }, up, down);
      }

      return h('div', null,
        h('label', { class: 'field' }, h('span', null, 'タイトル'), title),
        error,
        h('label', { class: 'field' }, h('span', null, '時刻（任意）'), time),
        h('label', { class: 'field' }, h('span', null, 'メモ（任意・500文字まで）'), memo),
        moveRow,
        h('div', { class: 'sheet-actions' },
          h('button', { class: 'btn btn-danger', type: 'button', onclick: () => { close(); tasks.deleteTask(id); } }, '削除'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, '保存')));
    });
  }

  function renderAll() {
    // ドラッグ中は DOM を作り直さない（終了後にまとめて反映）
    if (isDragging()) {
      pendingRender = true;
      return;
    }
    pendingRender = false;
    renderHeader();
    renderLeftovers();
    renderList();
  }

  renderAll();
  return subscribe(renderAll);
}
