import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportSettings,
  buildPremiereXml,
  framesToTimecode,
  normalizeProject,
  packIntoTracks,
  parseTimecode,
  prepareTimeline,
  secondsToFrames,
} from '../docs/lib/premiere.js';
import { buildZip } from '../docs/lib/zip.js';

test('25 fps time conversion is frame accurate', () => {
  assert.equal(secondsToFrames(83.48, '25'), 2087);
  assert.equal(framesToTimecode(2087, '25'), '00:01:23:12');
  assert.equal(parseTimecode('01:00:00:00', '25'), 90000);
});

test('project normalization supports current Pravochnaya JSON', () => {
  const project = normalizeProject({
    projectName: 'Test',
    authorName: 'Author',
    comments: [{ time: 2.5, type: 'Монтаж', text: 'Cut', status: 'open' }],
  });
  assert.equal(project.projectName, 'Test');
  assert.equal(project.comments.length, 1);
  assert.equal(project.comments[0].author, 'Author');
});

test('overlapping overlays are packed into separate tracks', () => {
  const tracks = packIntoTracks([
    { startFrame: 0, endFrame: 50 },
    { startFrame: 25, endFrame: 75 },
    { startFrame: 75, endFrame: 100 },
  ]);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].length, 2);
});

test('Premiere XML contains sequence, media clips and markers', () => {
  const project = normalizeProject({
    projectName: 'XML Test',
    comments: [
      { id: 'a', time: 1, type: 'Графика', text: 'Logo', author: 'A', status: 'open' },
      { id: 'b', time: 1.5, type: 'Звук', text: 'Music', author: 'B', status: 'done' },
    ],
  });
  const settings = buildExportSettings({ fps: '25', width: 1920, height: 1080, overlayDurationSeconds: 2 });
  const prepared = prepareTimeline(project, settings);
  const xml = buildPremiereXml(project, settings, prepared);
  assert.match(xml, /<xmeml version="5">/);
  assert.match(xml, /<sequence id="sequence-1">/);
  assert.match(xml, /<marker>/);
  assert.match(xml, /overlays\/001_/);
  assert.equal(prepared.tracks.length, 2);
});

test('minimal ZIP writer creates standard signatures', async () => {
  const blob = await buildZip([
    { name: 'hello.txt', data: 'Привет' },
    { name: 'folder/test.xml', data: '<xmeml />' },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034B50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054B50);
});
