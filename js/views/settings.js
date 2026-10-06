import { h } from '../ui/dom.js';
import { state, save, notify, reload } from '../store.js';
import * as storage from '../storage.js';
import { buildExport, parseImport, applyImport } from '../backup.js';
import { runRollover } from '../rollover.js';
import { setDateOverride, getToday, formatDate } from '../date.js';
import { isDebug } from '../debug.js';
import { APP_VERSION } from '../version.js';
import { confirmDialog } from '../ui/dialog.js';
import { openSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';

function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'segmented', role: 'group' });
  const sync = (v) => [...wrap.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  options.forEach(([v, label]) => {
    wrap.append(h('button', { type: 'button', 'data-value': v, onclick: () => { sync(v); onChange(v); } }, label));
  });
  sync(value);
  return wrap;
}

const row = (label, control, note) =>
  h('div', { class: 'setting' }, h('div', { class: 'setting-label' }, label), control, note ? h('p', { class: 'note' }, note) : null);

function helpBody() {
  const p = (t) => h('p', null, t);
  return h('div', { class: 'help' },
    h('h3', null, 'データの保存'),
    p('データはこの端末のこのアプリ内にのみ保存され、外部には送信されません。'),
    p('Safari で開いた場合と、ホーム画面から起動した場合とでは、保存データが別になります。移行したいときは、設定の「エクスポート」と「インポート」を使ってください。'),
    h('h3', null, '通知と日またぎ'),
    p('通知やリマインドの機能はありません。完了済みのタスクは翌日に消え、未完了のタスクは「昨日の残り」に移ります。'),
    h('h3', null, 'アクセス解析'),
    p('アクセス解析で送るのはページ表示の情報のみで、タスクの内容は送りません。設定でオフにできます。'));
}

export function mount(root) {
  const importError = h('p', { class: 'field-error', hidden: true });
  let mode = 'merge';
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    importError.hidden = true;
    try {
      const data = parseImport(await file.text());
      if (mode === 'replace' && !(await confirmDialog('今のデータをすべて置き換えます。よろしいですか？', '置き換える'))) return;
      applyImport(data, mode);
      showToast('インポートしました');
    } catch (e) {
      importError.textContent = `インポートできませんでした：${e.message}（データは変更されていません）`;
      importError.hidden = false;
    }
  });

  const exportData = () => {
    const blob = new Blob([buildExport()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `kyoumemo-${formatDate(new Date())}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const clearAll = async () => {
    if (!(await confirmDialog('すべてのデータを削除します。元に戻せません。よろしいですか？', 'すべて削除'))) return;
    storage.removeAll();
    reload();
    runRollover();
    notify();
    showToast('すべてのデータを削除しました');
  };

  root.append(
    h('h1', { class: 'today-date' }, '設定'),

    h('section', { class: 'group' },
      h('h2', { class: 'section-title' }, '表示'),
      row('文字サイズ', segmented([['normal', '標準'], ['large', '大']], state.settings.fontSize, (v) => { state.settings.fontSize = v; save('settings'); })),
      row('完了済みタスク', segmented([['show', '表示する'], ['hide', '折りたたむ']], state.settings.showDone ? 'show' : 'hide', (v) => { state.settings.showDone = v === 'show'; save('settings'); }))),

    h('section', { class: 'group' },
      h('h2', { class: 'section-title' }, 'アクセス解析'),
      row('アクセス解析を送信しない', segmented([['on', 'オン'], ['off', 'オフ']], state.settings.noAnalytics ? 'on' : 'off', (v) => { state.settings.noAnalytics = v === 'on'; save('settings'); }),
        '送るのは起動時のページ表示の情報のみで、タスクの内容は送りません。変更は次回の起動から反映されます。')),

    h('section', { class: 'group' },
      h('h2', { class: 'section-title' }, 'データ管理'),
      h('div', { class: 'setting' },
        h('button', { class: 'btn block', type: 'button', onclick: exportData }, 'エクスポート（JSON）')),
      h('div', { class: 'setting' },
        h('div', { class: 'setting-label' }, 'インポート'),
        segmented([['merge', '統合'], ['replace', '置き換え']], mode, (v) => { mode = v; }),
        h('button', { class: 'btn block spaced', type: 'button', onclick: () => fileInput.click() }, 'ファイルを選んで取り込む'),
        fileInput,
        importError),
      h('div', { class: 'setting' },
        h('button', { class: 'btn btn-danger block', type: 'button', onclick: clearAll }, 'すべてのデータを削除'))),

    isDebug ? debugSection() : null,

    h('section', { class: 'group' },
      h('h2', { class: 'section-title' }, 'アプリについて'),
      row('バージョン', h('span', null, APP_VERSION)),
      h('div', { class: 'setting' },
        h('button', { class: 'btn block', type: 'button', onclick: () => openSheet('ヘルプ', (close) => h('div', null, helpBody(), h('div', { class: 'sheet-actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, '閉じる')))) }, 'ヘルプ'))),
  );
}

function debugSection() {
  const input = h('input', { type: 'date', value: getToday() });
  const apply = () => {
    if (!input.value) return;
    storage.writeRaw('debugDate', input.value);
    setDateOverride(input.value);
    runRollover();
    notify();
    showToast(`今日を ${input.value} として扱います`);
  };
  const release = () => {
    storage.writeRaw('debugDate', null);
    setDateOverride(null);
    notify();
    showToast('日付の上書きを解除しました');
  };
  return h('section', { class: 'group' },
    h('h2', { class: 'section-title' }, 'デバッグ'),
    h('div', { class: 'setting' },
      h('div', { class: 'setting-label' }, '今日の日付を上書き'),
      h('label', { class: 'field' }, input),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn', type: 'button', onclick: release }, '解除'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: apply }, '適用')),
      h('p', { class: 'note' }, '上書き値はエクスポートに含まれず、アクセス解析も送りません。過去の日付に戻してもロールオーバーは動きません。')));
}
