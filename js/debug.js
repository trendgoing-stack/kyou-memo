// URL に ?debug=1 が付いているときだけ有効なテスト用機能
export const isDebug = new URLSearchParams(location.search).get('debug') === '1';
