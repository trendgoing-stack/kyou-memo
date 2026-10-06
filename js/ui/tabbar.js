import { h } from './dom.js';
import { state, subscribe } from '../store.js';

const TABS = [
  { route: 'today', label: '今日', icon: '✓' },
  { route: 'routines', label: '定型', icon: '↻' },
  { route: 'history', label: '振り返り', icon: '▤' },
  { route: 'settings', label: '設定', icon: '⚙' },
];

export function mountTabbar(el) {
  let active = 'today';

  function render() {
    el.replaceChildren(
      ...TABS.map((t) => {
        const count = t.route === 'today' ? state.leftovers.length : 0;
        return h(
          'a',
          { class: 'tab', href: `#/${t.route}`, 'aria-current': t.route === active ? 'page' : null },
          h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon),
          h('span', null, t.label),
          count > 0 ? h('span', { class: 'tab-badge', 'aria-label': `昨日の残り${count}件` }, count > 99 ? '99+' : count) : null,
        );
      }),
    );
  }

  subscribe(render);
  render();
  return (route) => {
    active = route;
    render();
  };
}
