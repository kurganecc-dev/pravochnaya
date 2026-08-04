import {
  buildExportSettings,
  buildImportReadme,
  buildManifestCsv,
  buildPremiereXml,
  normalizeProject,
  prepareTimeline,
  sanitizeFilename,
} from './lib/premiere.js';
import { renderOverlay } from './lib/overlay.js';

const $ = (selector) => document.querySelector(selector);

const els = {
  dialog: $('#premiereDialog'),
  close: $('#closePremiereDialogBtn'),
  cancel: $('#cancelPremiereExportBtn'),
  create: $('#createPremiereExportBtn'),
  fps: $('#premiereFps'),
  resolution: $('#premiereResolution'),
  widthField: $('#premiereWidthField'),
  heightField: $('#premiereHeightField'),
  width: $('#premiereWidth'),
  height: $('#premiereHeight'),
  startTimecode: $('#premiereStartTimecode'),
  duration: $('#premiereOverlayDuration'),
  exportMode: $('#premiereExportMode'),
  overlayStyle: $('#premiereOverlayStyle'),
  progress: $('#premiereProgress'),
  progressBar: $('#premiereProgressBar'),
  progressText: $('#premiereProgressText'),
};

let exporting = false;

function api() {
  return window.PRAVOCHNAYA_API || null;
}

function showMessage(message) {
  if (api()?.showToast) api().showToast(message);
  else window.alert(message);
}

function setProgress(value, text) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  els.progress.classList.remove('hidden');
  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = text;
}

function setBusy(value) {
  exporting = value;
  els.create.disabled = value;
  els.cancel.disabled = value;
  els.close.disabled = value;
  els.create.textContent = value ? 'Собираем ZIP…' : 'Скачать ZIP для Premiere';
  if (!value) els.progress.classList.add('hidden');
}

function updateCustomResolution() {
  const custom = els.resolution.value === 'custom';
  els.widthField.classList.toggle('hidden', !custom);
  els.heightField.classList.toggle('hidden', !custom);
}

function applyVideoResolution() {
  const info = api()?.getVideoInfo?.() || {};
  if (!info.width || !info.height) return;
  const preset = `${info.width}x${info.height}`;
  const option = [...els.resolution.options].find((item) => item.value === preset);
  if (option) {
    els.resolution.value = preset;
  } else {
    els.resolution.value = 'custom';
    els.width.value = String(info.width);
    els.height.value = String(info.height);
  }
  updateCustomResolution();
}

function getSettings() {
  let width;
  let height;
  if (els.resolution.value === 'custom') {
    width = Number(els.width.value);
    height = Number(els.height.value);
  } else {
    [width, height] = els.resolution.value.split('x').map(Number);
  }
  const videoInfo = api()?.getVideoInfo?.() || {};
  return buildExportSettings({
    width,
    height,
    fps: els.fps.value,
    startTimecode: els.startTimecode.value.trim(),
    overlayDurationSeconds: Number(els.duration.value),
    sequenceDurationSeconds: Number(videoInfo.duration) || 0,
    overlayStyle: els.overlayStyle.value,
    thumbnailPosition: 'right',
  });
}

function dataUrlBase64(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : '';
}

function screenshotExtension(comment) {
  const mime = String(comment.screenshotMime || comment.screenshotDataUrl || '');
  return mime.includes('png') ? 'png' : 'jpg';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openDialog() {
  const project = api()?.getProjectSnapshot?.();
  if (!project?.comments?.length) {
    showMessage('Добавьте хотя бы одну правку перед экспортом в Premiere');
    return;
  }
  applyVideoResolution();
  els.dialog.showModal();
}

async function createPremiereZip() {
  if (exporting) return;
  const projectSnapshot = api()?.getProjectSnapshot?.();
  if (!projectSnapshot) {
    showMessage('Не удалось получить текущий проект');
    return;
  }
  if (typeof window.JSZip !== 'function') {
    showMessage('Модуль ZIP не загрузился. Обновите страницу');
    return;
  }

  try {
    setBusy(true);
    setProgress(0.02, 'Проверяем проект…');
    const project = normalizeProject(projectSnapshot);
    if (!project.comments.length) throw new Error('В проекте нет правок');
    const settings = getSettings();
    const prepared = prepareTimeline(project, settings);
    if (!prepared.items.length) throw new Error('В проекте нет правок для экспорта');

    const markersOnly = els.exportMode.value === 'markers-only';
    const xmlPrepared = markersOnly ? { items: prepared.items, tracks: [] } : prepared;
    const zip = new window.JSZip();
    zip.file('pravochnaya-premiere.xml', buildPremiereXml(project, settings, xmlPrepared));
    zip.file('comments.csv', buildManifestCsv(project, settings, prepared));
    zip.file('project.json', JSON.stringify(projectSnapshot, null, 2));

    let readme = buildImportReadme(project, settings, xmlPrepared);
    if (markersOnly) {
      readme += '\nРЕЖИМ ЭКСПОРТА\n\nВ XML добавлены только sequence markers. PNG-оверлеи не создавались.\n';
    }
    zip.file('README-PREMIERE.txt', readme);

    const screenshotFolder = zip.folder('screenshots');
    project.comments.forEach((comment, index) => {
      if (!comment.screenshotDataUrl) return;
      const name = `${String(index + 1).padStart(3, '0')}.${screenshotExtension(comment)}`;
      screenshotFolder.file(name, dataUrlBase64(comment.screenshotDataUrl), { base64: true });
    });

    if (!markersOnly) {
      const overlays = zip.folder('overlays');
      for (let index = 0; index < prepared.items.length; index += 1) {
        const item = prepared.items[index];
        setProgress(0.08 + (index / prepared.items.length) * 0.62, `Создаём PNG ${index + 1} из ${prepared.items.length}…`);
        const rendered = await renderOverlay(item, settings);
        overlays.file(item.filename.replace(/^overlays\//, ''), rendered.blob);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    setProgress(0.74, 'Упаковываем файлы…');
    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (metadata) => setProgress(0.74 + (metadata.percent / 100) * 0.25, `Упаковываем ZIP: ${Math.round(metadata.percent)}%`),
    );
    setProgress(1, 'Готово');
    const filename = `${sanitizeFilename(project.projectName, 'pravochnaya')}-premiere.zip`;
    downloadBlob(blob, filename);
    els.dialog.close();
    showMessage('ZIP для Adobe Premiere Pro подготовлен');
  } catch (error) {
    console.error('Premiere export failed', error);
    showMessage(error.message || 'Не удалось создать проект для Premiere');
  } finally {
    setBusy(false);
  }
}

window.addEventListener('pravochnaya:premiere-export', openDialog);
els.resolution.addEventListener('change', updateCustomResolution);
els.exportMode.addEventListener('change', () => {
  els.overlayStyle.disabled = els.exportMode.value === 'markers-only';
});
els.close.addEventListener('click', () => { if (!exporting) els.dialog.close(); });
els.cancel.addEventListener('click', () => { if (!exporting) els.dialog.close(); });
els.create.addEventListener('click', () => { void createPremiereZip(); });
els.dialog.addEventListener('cancel', (event) => {
  if (exporting) event.preventDefault();
});
updateCustomResolution();
