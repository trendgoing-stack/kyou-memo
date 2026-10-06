import { h } from '../ui/dom.js';
import { subscribe } from '../store.js';
import { getRecords, summarize } from '../history.js';
import { formatLong } from '../date.js';

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
    box.replaceChildren(
      h('div', { class: 'stats' }, card('直近7日', summarize(records, 7)), card('直近30日', summarize(records, 30))),
      h('ul', { class: 'list spaced' }, records.map((r) => {
        const pct = r.total ? (r.done / r.total) * 100 : 0;
        return h('li', { class: 'history-row' },
          h('div', { class: 'history-top' },
            h('span', null, formatLong(r.date)),
            h('span', { class: 'history-count' }, `${r.done} / ${r.total}`)),
          h('div', { class: 'bar', role: 'img', 'aria-label': `完了率 ${Math.round(pct)}%` }, h('span', { style: `width:${pct}%` })));
      })),
    );
  }

  render();
  return subscribe(render);
}
