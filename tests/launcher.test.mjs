import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../docs/brief-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../docs/styles.css', import.meta.url), 'utf8');

test('first-run launcher contains two clear service choices', () => {
  assert.match(html, /id="serviceLauncher"/);
  assert.match(html, /data-launch-view="brief"/);
  assert.match(html, /data-launch-view="review"/);
  assert.match(html, /Заполнить бриф/);
  assert.match(html, /Оставить правки/);
});

test('launcher remembers the last selected service and remains reopenable', () => {
  assert.match(js, /VIEW_STORAGE_KEY/);
  assert.match(js, /rememberView\(view\)/);
  assert.match(js, /serviceHomeBtn\.addEventListener/);
  assert.match(js, /openServices/);
});

test('launcher has responsive styles', () => {
  assert.match(css, /\.service-launcher-grid/);
  assert.match(css, /@media \(max-width: 680px\)/);
});
