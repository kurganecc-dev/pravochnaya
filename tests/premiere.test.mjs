import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildExportSettings,
  buildPremiereXml,
  framesToTimecode,
  normalizeProject,
  packIntoTracks,
  prepareTimeline,
  secondsToFrames,
} from '../docs/lib/premiere.js';

test('25 fps timecodes are frame accurate', () => {
  assert.equal(secondsToFrames(83.48, '25'), 2087);
  assert.equal(framesToTimecode(2087, '25'), '00:01:23:12');
});

test('overlapping overlays are distributed across tracks', () => {
  const tracks = packIntoTracks([
    { startFrame: 0, endFrame: 50 },
    { startFrame: 25, endFrame: 75 },
    { startFrame: 75, endFrame: 100 },
  ]);
  assert.equal(tracks.length, 2);
});

test('Premiere XML contains markers and overlay tracks', () => {
  const project = normalizeProject({
    projectName: 'Тест',
    comments: [{ time: 1, text: 'Исправить титр', type: 'Текст', author: 'Анна' }],
  });
  const settings = buildExportSettings({ fps: '25', width: 1920, height: 1080 });
  const prepared = prepareTimeline(project, settings);
  const xml = buildPremiereXml(project, settings, prepared);
  assert.match(xml, /<xmeml version="5">/);
  assert.match(xml, /<marker>/);
  assert.match(xml, /overlays%2F|overlays\//);
});

test('original interface and Premiere additions coexist', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../docs/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="localVideoInput"/);
  assert.match(html, /id="commentsList"/);
  assert.match(html, /data-export="premiere"/);
  assert.match(html, /src="app\.js"/);
  assert.match(html, /src="premiere-export\.js"/);
  assert.match(app, /window\.PRAVOCHNAYA_API/);
});


test('all JavaScript id lookups exist and HTML ids are unique', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../docs/app.js', import.meta.url), 'utf8');
  const premiere = await readFile(new URL('../docs/premiere-export.js', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML contains duplicate ids');
  const required = [...`${app}\n${premiere}`.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(required)].filter((id) => !ids.includes(id));
  assert.deepEqual(missing, []);
});
