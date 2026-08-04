import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExportSettings,
  buildImportReadme,
  buildManifestCsv,
  buildPremiereXml,
  normalizeProject,
  prepareTimeline,
} from '../docs/lib/premiere.js';
import { buildZip } from '../docs/lib/zip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(await fs.readFile(path.join(root, 'docs/sample/pravochnaya-demo.json'), 'utf8'));
const project = normalizeProject(raw);
const settings = buildExportSettings({ fps: '25', width: 1920, height: 1080, overlayDurationSeconds: 2 });
const prepared = prepareTimeline(project, settings);
const xml = buildPremiereXml(project, settings, prepared);

if (!xml.includes('<xmeml version="5">') || !xml.includes('<marker>')) throw new Error('XML smoke test failed');

const zip = await buildZip([
  { name: 'pravochnaya-premiere.xml', data: xml },
  { name: 'manifest.csv', data: buildManifestCsv(project, settings, prepared) },
  { name: 'README_IMPORT.txt', data: buildImportReadme(project, settings, prepared) },
]);
const output = path.join(root, 'verify-output.zip');
await fs.writeFile(output, Buffer.from(await zip.arrayBuffer()));
console.log(`Verified ${prepared.items.length} comments, ${prepared.tracks.length} tracks.`);
console.log(output);
