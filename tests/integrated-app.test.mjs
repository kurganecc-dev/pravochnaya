import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('integrated Pravochnaya page contains review and Premiere flows', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../docs/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="localVideoInput"/);
  assert.match(html, /id="commentText"/);
  assert.match(html, /data-export="premiere"/);
  assert.match(html, /id="premiereDialog"/);
  assert.match(app, /async function addComment/);
  assert.match(app, /async function exportPremiere/);
  assert.match(app, /buildPremiereXml/);
});
