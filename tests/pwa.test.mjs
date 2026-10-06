// sw.js の版数・プリキャッシュ一覧が、実ファイルとずれていないことを確認する
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../js/version.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

test('sw.js の VERSION が version.js と一致', () => {
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], APP_VERSION);
});

test('プリキャッシュ一覧が css / js / icons の実ファイルと一致', () => {
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((p) => p.includes('.'));
  for (const p of listed) assert.ok(existsSync(join(root, p)), `存在しない: ${p}`);
  for (const dir of ['css', 'js', 'icons']) {
    for (const f of walk(join(root, dir))) {
      const rel = relative(root, f).replaceAll('\\', '/');
      assert.ok(listed.includes(rel), `一覧にない: ${rel}`);
    }
  }
});

test('manifest の相対パスと名称', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.name, '今日メモ');
  assert.equal(m.short_name, '今日メモ');
});
