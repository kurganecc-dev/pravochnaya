import {
  buildExportSettings,
  buildImportReadme,
  buildManifestCsv,
  buildPremiereXml,
  framesToTimecode,
  normalizeProject,
  prepareTimeline,
  sanitizeFilename,
  secondsToFrames,
} from './lib/premiere.js';
import { renderOverlay } from './lib/overlay.js';
import { buildZip } from './lib/zip.js';

const $ = (selector) => document.querySelector(selector);

const els = {
  jsonInput: $('#jsonInput'),
  dropzone: $('#dropzone'),
  demoBtn: $('#demoBtn'),
  exportBtn: $('#exportBtn'),
  exportBtnSide: $('#exportBtnSide'),
  projectStatus: $('#projectStatus'),
  projectSummary: $('#projectSummary'),
  projectName: $('#projectName'),
  projectAuthor: $('#projectAuthor'),
  projectCount: $('#projectCount'),
  projectScreenshots: $('#projectScreenshots'),
  fps: $('#fps'),
  resolution: $('#resolution'),
  widthField: $('#widthField'),
  heightField: $('#heightField'),
  width: $('#width'),
  height: $('#height'),
  startTimecode: $('#startTimecode'),
  overlayDuration: $('#overlayDuration'),
  overlayStyle: $('#overlayStyle'),
  thumbnailPosition: $('#thumbnailPosition'),
  commentsEmpty: $('#commentsEmpty'),
  commentsList: $('#commentsList'),
  selectAllBtn: $('#selectAllBtn'),
  selectNoneBtn: $('#selectNoneBtn'),
  previewCanvas: $('#previewCanvas'),
  previewPlaceholder: $('#previewPlaceholder'),
  previewTitle: $('#previewTitle'),
  progress: $('#progress'),
  progressBar: $('#progressBar'),
  progressText: $('#progressText'),
  toast: $('#toast'),
};

const state = {
  rawProject: null,
  project: null,
  selectedId: null,
  exporting: false,
  previewVersion: 0,
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2800);
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
  return buildExportSettings({
    width,
    height,
    fps: els.fps.value,
    startTimecode: els.startTimecode.value.trim(),
    overlayDurationSeconds: els.overlayDuration.value,
    overlayStyle: els.overlayStyle.value,
    thumbnailPosition: els.thumbnailPosition.value,
  });
}

function setExportEnabled(enabled) {
  els.exportBtn.disabled = !enabled || state.exporting;
  els.exportBtnSide.disabled = !enabled || state.exporting;
}

function updateProjectSummary() {
  if (!state.project) {
    els.projectSummary.classList.add('hidden');
    els.projectStatus.classList.remove('ready');
    els.projectStatus.textContent = 'Проект не загружен';
    setExportEnabled(false);
    return;
  }
  const screenshots = state.project.comments.filter((comment) => comment.screenshotDataUrl).length;
  els.projectName.textContent = state.project.projectName;
  els.projectAuthor.textContent = state.project.authorName || '—';
  els.projectCount.textContent = String(state.project.comments.length);
  els.projectScreenshots.textContent = String(screenshots);
  els.projectSummary.classList.remove('hidden');
  els.projectStatus.classList.add('ready');
  els.projectStatus.textContent = 'Готов к экспорту';
  setExportEnabled(state.project.comments.some((comment) => comment.enabled));
}

function formatSeconds(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  const ms = Math.floor((value % 1) * 1000);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function renderComments() {
  els.commentsList.innerHTML = '';
  if (!state.project?.comments.length) {
    els.commentsEmpty.classList.remove('hidden');
    els.commentsList.classList.add('hidden');
    return;
  }
  els.commentsEmpty.classList.add('hidden');
  els.commentsList.classList.remove('hidden');

  let settings;
  try { settings = getSettings(); } catch { settings = buildExportSettings(); }

  state.project.comments.forEach((comment, index) => {
    const row = document.createElement('div');
    row.className = `comment-row${comment.id === state.selectedId ? ' active' : ''}${comment.enabled ? '' : ' disabled'}`;
    row.dataset.id = comment.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = comment.enabled;
    checkbox.setAttribute('aria-label', `Включить правку ${index + 1}`);
    checkbox.addEventListener('click', (event) => event.stopPropagation());
    checkbox.addEventListener('change', () => {
      comment.enabled = checkbox.checked;
      row.classList.toggle('disabled', !comment.enabled);
      setExportEnabled(state.project.comments.some((item) => item.enabled));
      if (!comment.enabled && state.selectedId === comment.id) {
        const next = state.project.comments.find((item) => item.enabled);
        state.selectedId = next?.id || comment.id;
        renderComments();
        void renderPreview();
      }
    });

    const time = document.createElement('div');
    time.className = 'comment-time';
    time.textContent = framesToTimecode(secondsToFrames(comment.time, settings.fps), settings.fps);
    time.title = formatSeconds(comment.time);

    const type = document.createElement('div');
    type.className = 'comment-type';
    type.textContent = comment.type;

    const copy = document.createElement('div');
    copy.className = 'comment-copy';
    const title = document.createElement('strong');
    title.textContent = comment.text;
    const meta = document.createElement('span');
    meta.textContent = `${comment.author} · ${comment.status === 'done' ? 'Выполнено' : 'Открыто'}`;
    copy.append(title, meta);

    const shot = document.createElement('span');
    shot.className = `shot-indicator${comment.screenshotDataUrl ? '' : ' missing'}`;
    shot.textContent = comment.screenshotDataUrl ? 'Есть кадр' : 'Без кадра';

    row.append(checkbox, time, type, copy, shot);
    row.addEventListener('click', () => {
      state.selectedId = comment.id;
      renderComments();
      void renderPreview();
    });
    els.commentsList.append(row);
  });
}

async function renderPreview() {
  const previewVersion = ++state.previewVersion;
  const comment = state.project?.comments.find((item) => item.id === state.selectedId);
  if (!comment) {
    els.previewPlaceholder.classList.remove('hidden');
    els.previewTitle.textContent = 'PNG-оверлей';
    const ctx = els.previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
    return;
  }

  try {
    const settings = getSettings();
    const prepared = prepareTimeline({ ...state.project, comments: [comment] }, settings);
    const item = { ...prepared.items[0], index: state.project.comments.findIndex((entry) => entry.id === comment.id) + 1 };
    els.previewTitle.textContent = `Правка #${item.index}`;
    els.previewPlaceholder.textContent = 'Создаём предпросмотр…';
    els.previewPlaceholder.classList.remove('hidden');
    const result = await renderOverlay(item, settings);
    if (previewVersion !== state.previewVersion) return;
    els.previewCanvas.width = settings.width;
    els.previewCanvas.height = settings.height;
    const ctx = els.previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, settings.width, settings.height);
    ctx.drawImage(result.canvas, 0, 0);
    els.previewPlaceholder.classList.add('hidden');
  } catch (error) {
    if (previewVersion !== state.previewVersion) return;
    els.previewPlaceholder.textContent = error.message || 'Не удалось показать оверлей';
    els.previewPlaceholder.classList.remove('hidden');
  }
}

async function loadProjectObject(raw, sourceLabel = 'JSON') {
  try {
    const project = normalizeProject(raw);
    if (!project.comments.length) throw new Error('В проекте нет правок');
    state.rawProject = raw;
    state.project = project;
    state.selectedId = project.comments[0]?.id || null;
    updateProjectSummary();
    renderComments();
    await renderPreview();
    showToast(`${sourceLabel}: загружено ${project.comments.length} правок`);
  } catch (error) {
    showToast(error.message || 'Не удалось загрузить проект');
  }
}

async function loadJsonFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    await loadProjectObject(raw, file.name);
  } catch (error) {
    showToast(error instanceof SyntaxError ? 'Файл не является корректным JSON' : error.message);
  }
}

function updateProgress(percent, text) {
  els.progress.classList.remove('hidden');
  els.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  els.progressText.textContent = text;
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

async function exportZip() {
  if (!state.project || state.exporting) return;
  let settings;
  try {
    settings = getSettings();
  } catch (error) {
    showToast(error.message);
    return;
  }

  const prepared = prepareTimeline(state.project, settings);
  if (!prepared.items.length) {
    showToast('Выберите хотя бы одну правку');
    return;
  }

  state.exporting = true;
  setExportEnabled(true);
  els.exportBtn.textContent = 'Собираем ZIP…';
  els.exportBtnSide.textContent = 'Собираем ZIP…';

  try {
    const files = [];
    const total = prepared.items.length;

    for (let index = 0; index < total; index += 1) {
      const item = prepared.items[index];
      updateProgress(Math.round((index / total) * 70), `PNG ${index + 1} из ${total}: ${item.type}`);
      const { blob } = await renderOverlay(item, settings);
      files.push({ name: item.filename, data: blob });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    updateProgress(73, 'Формируем Premiere XML…');
    const xml = buildPremiereXml(state.project, settings, prepared);
    files.push({ name: 'pravochnaya-premiere.xml', data: xml });
    files.push({ name: 'manifest.csv', data: buildManifestCsv(state.project, settings, prepared) });
    files.push({ name: 'manifest.json', data: JSON.stringify({
      generator: 'Pravochnaya Premiere Exporter',
      generatedAt: new Date().toISOString(),
      project: state.project.projectName,
      settings,
      comments: prepared.items.map(({ screenshotDataUrl, annotations, ...item }) => item),
    }, null, 2) });
    files.push({ name: 'README_IMPORT.txt', data: buildImportReadme(state.project, settings, prepared) });
    files.push({ name: 'source-project.json', data: JSON.stringify(state.rawProject || state.project, null, 2) });

    updateProgress(80, 'Собираем ZIP…');
    const blob = await buildZip(files, (progress) => {
      updateProgress(80 + Math.round(progress * 20), `Собираем ZIP: ${Math.round(progress * 100)}%`);
    });

    const filename = `${sanitizeFilename(state.project.projectName, 'pravochnaya')}-premiere.zip`;
    downloadBlob(blob, filename);
    updateProgress(100, 'ZIP готов');
    showToast(`Готово: ${prepared.items.length} правок, дорожек оверлеев — ${prepared.tracks.length}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Не удалось создать ZIP');
  } finally {
    state.exporting = false;
    setExportEnabled(state.project.comments.some((comment) => comment.enabled));
    els.exportBtn.textContent = 'Скачать ZIP для Premiere';
    els.exportBtnSide.textContent = 'Скачать ZIP для Premiere';
    setTimeout(() => els.progress.classList.add('hidden'), 3500);
  }
}

els.jsonInput.addEventListener('change', (event) => {
  void loadJsonFile(event.target.files[0]);
  event.target.value = '';
});

els.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  els.dropzone.classList.add('dragover');
});
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
els.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('dragover');
  void loadJsonFile(event.dataTransfer.files[0]);
});

els.demoBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('sample/pravochnaya-demo.json');
    if (!response.ok) throw new Error('Демо-проект не найден');
    await loadProjectObject(await response.json(), 'Демо');
  } catch (error) {
    showToast(error.message);
  }
});

els.resolution.addEventListener('change', () => {
  const custom = els.resolution.value === 'custom';
  els.widthField.classList.toggle('hidden', !custom);
  els.heightField.classList.toggle('hidden', !custom);
  if (!custom) {
    const [width, height] = els.resolution.value.split('x');
    els.width.value = width;
    els.height.value = height;
  }
  void renderPreview();
});

[els.fps, els.width, els.height, els.startTimecode, els.overlayDuration, els.overlayStyle, els.thumbnailPosition]
  .forEach((input) => input.addEventListener('change', () => {
    renderComments();
    void renderPreview();
  }));

els.selectAllBtn.addEventListener('click', () => {
  if (!state.project) return;
  state.project.comments.forEach((comment) => { comment.enabled = true; });
  renderComments();
  setExportEnabled(true);
});
els.selectNoneBtn.addEventListener('click', () => {
  if (!state.project) return;
  state.project.comments.forEach((comment) => { comment.enabled = false; });
  renderComments();
  setExportEnabled(false);
});

els.exportBtn.addEventListener('click', () => void exportZip());
els.exportBtnSide.addEventListener('click', () => void exportZip());

updateProjectSummary();
