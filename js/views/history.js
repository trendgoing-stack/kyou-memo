import { h } from '../ui/dom.js';
import { state, subscribe } from '../store.js';
import { getRecords, summarize, togglePast, renamePast, addPast, deletePast } from '../history.js';
import { formatLong, getToday } from '../date.js';
import { openSheet } from '../ui/sheet.js';

export function mount(root) {
  const box = h('div');
  root.append(h('h1', { class: 'today-date' }, '振り返り'), box);

  const card = (label, s) =>
    h('div', { class: 'stat' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-value' }, s.rate == null ? '—' : `${s.rate}%`),
      h('div', { class: 'stat-sub' }, `完了 ${s.done} / ${s.total}`));

  function render() {
    const records = getRecords();
    if (records.length === 0) {
      return box.replaceChildren(h('div', { class: 'empty spaced' }, 'まだ記録がありません'));
    }
    const today = getToday();
    box.replaceChildren(
      h('div', { class: 'stats' }, card('直近7日', summarize(records, 7)), card('直近30日', summarize(records, 30))),
      h('p', { class: 'note spaced' }, '日付をタップすると、その日のタスクを修正できます。'),
      h('ul', { class: 'list' }, records.map((r) => {
        const pct = r.total ? (r.done / r.total) * 100 : 0;
        return h('li', { class: 'history-row' },
          h('button', {
            class: 'history-btn',
            type: 'button',
            onclick: () => (r.date === today ? (location.hash = '#/today') : openDay(r.date)),
          },
          h('div', { class: 'history-top' },
            h('span', null, formatLong(r.date)),
            h('span', { class: 'history-count' }, `${r.done} / ${r.total}　›`)),
          h('div', { class: 'bar', role: 'img', 'aria-label': `完了率 ${Math.round(pct)}%` }, h('span', { style: `width:${pct}%` }))));
      })),
    );
  }

  render();
  return subscribe(render);
}

/** 過去の日のタスクを修正するシート */
function openDay(date) {
  const rec = state.history[date];
  if (!rec) return;

  if (!rec.tasks) {
    openSheet(formatLong(date), (close) =>
      h('div', null,
        h('p', null, `完了 ${rec.done} / ${rec.total}`),
        h('p', { class: 'note' }, 'この日は、タスクの内容が保存されていないため修正できません。'),
        h('div', { class: 'sheet-actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, '閉じる'))));
    return;
  }

  openSheet(formatLong(date), (close) => {
    const summary = h('p', { class: 'note' });
    const list = h('ul', { class: 'list' });
    const input = h('input', { type: 'text', maxlength: '100', placeholder: 'この日のタスクを追加', autocomplete: 'off', 'aria-label': 'この日のタスクを追加' });
    const addBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, '追加');
    addBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    const form = h('form', { class: 'add-form' }, input, addBtn);
    form.classList.add('compact');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (addPast(date, input.value)) input.value = '';
      input.focus();
    });

    function row(t) {
      const title = h('input', { class: 'past-title', type: 'text', value: t.title, maxlength: '100', autocomplete: 'off', 'aria-label': 'タイトル' });
      title.addEventListener('change', () => {
        if (!renamePast(date, t.id, title.value)) title.value = t.title; // 空にはできない
      });
      return h('li', { class: 'task' + (t.done ? ' done' : '') },
        h('button', {
          class: 'check',
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(t.done),
          'aria-label': t.done ? '未完了に戻す' : '完了にする',
          onclick: () => togglePast(date, t.id),
        }, h('span', { class: 'checkmark', 'aria-hidden': 'true' }, '✓')),
        title,
        h('button', { class: 'link-btn danger', type: 'button', onclick: () => deletePast(date, t.id) }, '削除'));
    }

    function refresh() {
      const d = state.history[date];
      if (!d) {
        summary.textContent = '完了 0 / 0';
        list.replaceChildren(h('li', { class: 'empty' }, 'この日のタスクはありません'));
        return;
      }
      summary.textContent = `完了 ${d.done} / ${d.total}`;
      list.replaceChildren(...d.tasks.map(row));
    }

    refresh();
    // 保存のたびに通知されるので、それに合わせて更新する（シートが閉じたら購読を解除）
    const unsub = subscribe(() => (list.isConnected ? refresh() : unsub()));
    return h('div', null, summary, list, form,
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, '閉じる')));
  });
}
