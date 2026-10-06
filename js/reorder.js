// ハンドル（.handle）によるドラッグ並べ替え。Pointer Events で実装。
// 並べ替え対象の行は li[data-sortable]。ドラッグ中は DOM を入れ替えず、
// 行の追従表示と挿入線だけを動かし、指を離した時点で onCommit(新しい id 配列) を 1 回呼ぶ。
import { h } from './ui/dom.js';

let dragging = false;
export const isDragging = () => dragging;

const EDGE = 72; // 端からこの距離に入ると自動スクロール
const MAX_SPEED = 18; // px / フレーム

export function attachReorder(ul, { onCommit, onFinish }) {
  ul.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.handle');
    if (!handle || dragging) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const row = handle.closest('li[data-sortable]');
    if (row) start(e, handle, row);
  });

  function start(e, handle, row) {
    const rows = [...ul.querySelectorAll('li[data-sortable]')];
    if (rows.length < 2) return;
    dragging = true;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* 取れなくても window 側のイベントで追従できないため、中断扱いにする */
    }

    const scroll0 = window.scrollY;
    const ulTop = ul.getBoundingClientRect().top + scroll0;
    const rects = rows.map((r) => {
      const b = r.getBoundingClientRect();
      return { top: b.top + scroll0, bottom: b.bottom + scroll0 };
    });
    const idx0 = rows.indexOf(row);
    const others = rows.filter((r) => r !== row);
    const otherRects = rects.filter((_, i) => i !== idx0);
    const startPageY = e.clientY + scroll0;
    let clientY = e.clientY;
    let insertIndex = idx0;
    let raf = 0;
    let finished = false;

    const line = h('div', { class: 'drop-line' });
    ul.append(line);
    row.classList.add('dragging');
    document.body.classList.add('drag-active');

    function update() {
      const pageY = clientY + window.scrollY;
      row.style.transform = `translateY(${pageY - startPageY}px) scale(1.02)`;
      let n = 0;
      for (const r of otherRects) if ((r.top + r.bottom) / 2 < pageY) n++;
      insertIndex = n;
      const y = n < otherRects.length ? otherRects[n].top : otherRects[otherRects.length - 1].bottom;
      line.style.top = `${y - ulTop}px`;
    }

    function tick() {
      const tabbar = document.getElementById('tabbar');
      const bottomZone = window.innerHeight - (tabbar ? tabbar.offsetHeight : 0) - EDGE;
      let v = 0;
      if (clientY < EDGE) v = -MAX_SPEED * Math.min(1, (EDGE - clientY) / EDGE);
      else if (clientY > bottomZone) v = MAX_SPEED * Math.min(1, (clientY - bottomZone) / EDGE);
      if (v) {
        window.scrollBy(0, v);
        update();
      }
      raf = requestAnimationFrame(tick);
    }

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      clientY = ev.clientY;
      update();
    };
    const onUp = (ev) => ev.pointerId === e.pointerId && finish(true);
    const onCancel = (ev) => ev.pointerId === e.pointerId && finish(false);
    const onLost = () => finish(false);
    // iOS でページスクロールが混ざらないようにする保険
    const blockScroll = (ev) => ev.preventDefault();

    function finish(commit) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onCancel);
      handle.removeEventListener('lostpointercapture', onLost);
      document.removeEventListener('touchmove', blockScroll);
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* 既に解放済み */
      }
      row.classList.remove('dragging');
      row.style.transform = '';
      line.remove();
      document.body.classList.remove('drag-active');
      dragging = false;
      if (commit) {
        const ids = others.map((r) => r.dataset.id);
        ids.splice(insertIndex, 0, row.dataset.id);
        if (ids.join() !== rows.map((r) => r.dataset.id).join()) onCommit(ids);
      }
      onFinish && onFinish();
    }

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onCancel);
    handle.addEventListener('lostpointercapture', onLost);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    update();
    raf = requestAnimationFrame(tick);
  }
}
