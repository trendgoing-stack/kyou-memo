// ハッシュルーティング（#/today など）
import { closeSheet } from './ui/sheet.js';

const DEFAULT_ROUTE = 'today';

/**
 * routes: { name: () => import('./views/x.js') } 形式ではなく、
 * { name: { mount(root) → unmount } } を受け取る。
 */
export function startRouter(root, routes, onChange) {
  let unmount = null;

  function currentRoute() {
    const name = location.hash.replace(/^#\//, '');
    return routes[name] ? name : DEFAULT_ROUTE;
  }

  function render() {
    closeSheet();
    unmount && unmount();
    const name = currentRoute();
    root.replaceChildren();
    unmount = routes[name].mount(root) || null;
    onChange && onChange(name);
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', `#/${DEFAULT_ROUTE}`);
  render();
}
