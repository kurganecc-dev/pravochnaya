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
import { buildZip } from './lib/zip.js';

const STORAGE_KEY = 'video-review-service-v4-premiere';
const LEGACY_STORAGE_KEYS = ['video-review-service-v3', 'video-review-service-v2', 'video-review-service-v1'];
let remoteLoadId = 0;

const state = {
  comments: [],
  source: null,
  sortAsc: true,
  localSaveWarned: false,
  previewCommentId: null,
  premiereExporting: false,
  annotation: {
    enabled: false,
    strokes: [],
    currentStroke: null,
    pointerId: null,
    color: '#ff2d2d',
    size: 4,
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const els = {
  projectName: $('#projectName'), authorName: $('#authorName'), localVideoInput: $('#localVideoInput'), dropzone: $('#dropzone'),
  videoUrl: $('#videoUrl'), loadUrlBtn: $('#loadUrlBtn'), sourceCard: $('#sourceCard'), playerCard: $('#playerCard'), editorCard: $('#editorCard'),
  videoWrap: $('#videoWrap'), video: $('#video'), annotationCanvas: $('#annotationCanvas'), videoEmpty: $('#videoEmpty'), timeline: $('#timeline'), markers: $('#markers'),
  playBtn: $('#playBtn'), backBtn: $('#backBtn'), forwardBtn: $('#forwardBtn'), muteBtn: $('#muteBtn'), volume: $('#volume'), fullscreenBtn: $('#fullscreenBtn'),
  timeLabel: $('#timeLabel'), currentTimeBtn: $('#currentTimeBtn'), commentType: $('#commentType'), commentText: $('#commentText'), addCommentBtn: $('#addCommentBtn'),
  attachScreenshot: $('#attachScreenshot'), commentDuration: $('#commentDuration'), drawToggleBtn: $('#drawToggleBtn'), drawColor: $('#drawColor'), drawSize: $('#drawSize'),
  undoDrawBtn: $('#undoDrawBtn'), clearDrawBtn: $('#clearDrawBtn'), annotationStatus: $('#annotationStatus'), commentsCount: $('#commentsCount'), commentsList: $('#commentsList'),
  emptyState: $('#emptyState'), typeFilter: $('#typeFilter'), statusFilter: $('#statusFilter'), sortBtn: $('#sortBtn'), copyTextBtn: $('#copyTextBtn'), exportCsvBtn: $('#exportCsvBtn'),
  exportBtn: $('#exportBtn'), exportDialog: $('#exportDialog'), importBtn: $('#importBtn'), importInput: $('#importInput'), newProjectBtn: $('#newProjectBtn'), toast: $('#toast'),
  imagePreviewDialog: $('#imagePreviewDialog'), imagePreview: $('#imagePreview'), imagePreviewTitle: $('#imagePreviewTitle'), downloadPreviewImageBtn: $('#downloadPreviewImageBtn'), closePreviewBtn: $('#closePreviewBtn'),
  premiereDialog: $('#premiereDialog'), premiereFps: $('#premiereFps'), premiereResolution: $('#premiereResolution'), premiereWidthField: $('#premiereWidthField'),
  premiereHeightField: $('#premiereHeightField'), premiereWidth: $('#premiereWidth'), premiereHeight: $('#premiereHeight'), premiereStartTimecode: $('#premiereStartTimecode'),
  premiereOverlayDuration: $('#premiereOverlayDuration'), premiereOverlayStyle: $('#premiereOverlayStyle'), premiereThumbnailPosition: $('#premiereThumbnailPosition'),
  premiereCommentsCount: $('#premiereCommentsCount'), premiereCancelBtn: $('#premiereCancelBtn'), premiereExportBtn: $('#premiereExportBtn'), premiereProgress: $('#premiereProgress'),
  premiereProgressBar: $('#premiereProgressBar'), premiereProgressText: $('#premiereProgressText'),
};

const annotationCtx = els.annotationCanvas.getContext('2d');

function formatTime(seconds, withMs = false) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  const base = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return withMs ? `${base}.${String(ms).padStart(3, '0')}` : base;
}

function parseVideoTimecode(text) {
  const parts = String(text).trim().replace(',', '.').split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function getCanvasClientSize() {
  return {
    width: Math.max(1, Math.round(els.annotationCanvas.clientWidth || els.video.clientWidth || 1)),
    height: Math.max(1, Math.round(els.annotationCanvas.clientHeight || els.video.clientHeight || 1)),
  };
}

function getVideoDisplayRect() {
  const { width: boxWidth, height: boxHeight } = getCanvasClientSize();
  const videoWidth = els.video.videoWidth || 16;
  const videoHeight = els.video.videoHeight || 9;
  const videoAspect = videoWidth / videoHeight;
  const boxAspect = boxWidth / boxHeight;
  if (boxAspect > videoAspect) {
    const height = boxHeight;
    const width = height * videoAspect;
    return { x: (boxWidth - width) / 2, y: 0, width, height, canvasWidth: boxWidth, canvasHeight: boxHeight };
  }
  const width = boxWidth;
  const height = width / videoAspect;
  return { x: 0, y: (boxHeight - height) / 2, width, height, canvasWidth: boxWidth, canvasHeight: boxHeight };
}

function syncAnnotationCanvas() {
  const rect = els.videoWrap.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const targetWidth = Math.max(1, Math.round(rect.width * dpr));
  const targetHeight = Math.max(1, Math.round(rect.height * dpr));
  if (els.annotationCanvas.width !== targetWidth || els.annotationCanvas.height !== targetHeight) {
    els.annotationCanvas.width = targetWidth;
    els.annotationCanvas.height = targetHeight;
  }
  redrawAnnotations();
}

function renderStrokeToDisplay(ctx, stroke, displayRect) {
  if (!stroke?.points?.length) return;
  ctx.strokeStyle = stroke.color || '#ff2d2d';
  ctx.fillStyle = stroke.color || '#ff2d2d';
  ctx.lineWidth = Math.max(1, Number(stroke.size) || 4);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const x = displayRect.x + point.x * displayRect.width;
    const y = displayRect.y + point.y * displayRect.height;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(displayRect.x + point.x * displayRect.width, displayRect.y + point.y * displayRect.height, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function redrawAnnotations() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  annotationCtx.setTransform(1, 0, 0, 1, 0, 0);
  annotationCtx.clearRect(0, 0, els.annotationCanvas.width, els.annotationCanvas.height);
  annotationCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const displayRect = getVideoDisplayRect();
  state.annotation.strokes.forEach((stroke) => renderStrokeToDisplay(annotationCtx, stroke, displayRect));
  if (state.annotation.currentStroke) renderStrokeToDisplay(annotationCtx, state.annotation.currentStroke, displayRect);
}

function updateAnnotationStatus() {
  const count = state.annotation.strokes.length;
  els.annotationStatus.textContent = state.annotation.enabled
    ? (count ? `Рисование включено · штрихов: ${count}` : 'Рисование включено · рисуйте поверх кадра')
    : (count ? `Пометки подготовлены: ${count}` : 'Рисование выключено');
}

function setDrawMode(enabled) {
  state.annotation.enabled = Boolean(enabled);
  els.annotationCanvas.classList.toggle('drawing-enabled', state.annotation.enabled);
  els.drawToggleBtn.classList.toggle('active', state.annotation.enabled);
  els.drawToggleBtn.textContent = state.annotation.enabled ? '✓ Рисование включено' : '✎ Рисовать';
  if (state.annotation.enabled) els.video.pause();
  updateAnnotationStatus();
}

function clearAnnotations(notify = false) {
  state.annotation.strokes = [];
  state.annotation.currentStroke = null;
  state.annotation.pointerId = null;
  redrawAnnotations();
  updateAnnotationStatus();
  if (notify) showToast('Пометки очищены');
}

function undoAnnotation() {
  if (!state.annotation.strokes.length) return showToast('Нечего отменять');
  state.annotation.strokes.pop();
  redrawAnnotations();
  updateAnnotationStatus();
}

function getPointerPosition(event) {
  const canvasRect = els.annotationCanvas.getBoundingClientRect();
  const displayRect = getVideoDisplayRect();
  const x = event.clientX - canvasRect.left;
  const y = event.clientY - canvasRect.top;
  if (x < displayRect.x || x > displayRect.x + displayRect.width || y < displayRect.y || y > displayRect.y + displayRect.height) return null;
  return { x: (x - displayRect.x) / displayRect.width, y: (y - displayRect.y) / displayRect.height };
}

function beginStroke(event) {
  if (!state.annotation.enabled || event.button !== 0) return;
  const point = getPointerPosition(event);
  if (!point) return;
  event.preventDefault();
  state.annotation.pointerId = event.pointerId;
  state.annotation.currentStroke = { color: state.annotation.color, size: Number(state.annotation.size), points: [point] };
  els.annotationCanvas.setPointerCapture?.(event.pointerId);
  redrawAnnotations();
}

function extendStroke(event) {
  if (!state.annotation.enabled || state.annotation.pointerId !== event.pointerId || !state.annotation.currentStroke) return;
  const point = getPointerPosition(event);
  if (!point) return;
  event.preventDefault();
  state.annotation.currentStroke.points.push(point);
  redrawAnnotations();
}

function endStroke(event) {
  if (state.annotation.pointerId !== event.pointerId || !state.annotation.currentStroke) return;
  event.preventDefault();
  if (state.annotation.currentStroke.points.length) state.annotation.strokes.push(state.annotation.currentStroke);
  state.annotation.currentStroke = null;
  state.annotation.pointerId = null;
  redrawAnnotations();
  updateAnnotationStatus();
}

function getPremiereSettingsRaw() {
  let width;
  let height;
  if (els.premiereResolution.value === 'custom') {
    width = Number(els.premiereWidth.value);
    height = Number(els.premiereHeight.value);
  } else {
    [width, height] = els.premiereResolution.value.split('x').map(Number);
  }
  return {
    width, height, fps: els.premiereFps.value, startTimecode: els.premiereStartTimecode.value.trim(),
    overlayDurationSeconds: els.premiereOverlayDuration.value, overlayStyle: els.premiereOverlayStyle.value,
    thumbnailPosition: els.premiereThumbnailPosition.value, sequenceDurationSeconds: Number(els.video.duration) || 0,
  };
}

function applyPremiereSettings(settings = {}) {
  if (settings.fps) els.premiereFps.value = String(settings.fps);
  if (settings.startTimecode) els.premiereStartTimecode.value = settings.startTimecode;
  if (settings.overlayDurationSeconds) els.premiereOverlayDuration.value = settings.overlayDurationSeconds;
  if (settings.overlayStyle) els.premiereOverlayStyle.value = settings.overlayStyle;
  if (settings.thumbnailPosition) els.premiereThumbnailPosition.value = settings.thumbnailPosition;
  const resolution = `${settings.width || 1920}x${settings.height || 1080}`;
  const option = [...els.premiereResolution.options].find((item) => item.value === resolution);
  els.premiereResolution.value = option ? resolution : 'custom';
  els.premiereWidth.value = settings.width || 1920;
  els.premiereHeight.value = settings.height || 1080;
  updateCustomResolutionVisibility();
}

function projectSnapshot() {
  return {
    version: 3,
    projectName: els.projectName.value.trim(),
    authorName: els.authorName.value.trim(),
    source: state.source ? Object.fromEntries(Object.entries(state.source).filter(([key]) => key !== 'objectUrl')) : null,
    premiereSettings: getPremiereSettingsRaw(),
    comments: state.comments,
    savedAt: new Date().toISOString(),
  };
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectSnapshot()));
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Не удалось сохранить проект локально', error);
    if (!state.localSaveWarned) {
      state.localSaveWarned = true;
      showToast('Хранилище браузера переполнено. Скачайте JSON или ZIP');
    }
  }
}

function applyImportedData(data) {
  els.projectName.value = data.projectName || '';
  els.authorName.value = data.authorName || '';
  state.comments = Array.isArray(data.comments) ? data.comments.map((comment, index) => ({
    id: comment.id || `comment-${Date.now()}-${index}`,
    time: Math.max(0, Number(comment.time) || 0),
    durationSeconds: Math.max(0.04, Number(comment.durationSeconds) || 2),
    type: comment.type || 'Другое', text: comment.text || 'Без текста', author: comment.author || data.authorName || 'Без имени',
    status: comment.status === 'done' ? 'done' : 'open', createdAt: comment.createdAt || new Date().toISOString(),
    screenshotDataUrl: typeof comment.screenshotDataUrl === 'string' ? comment.screenshotDataUrl : null,
    sourceFrameDataUrl: typeof comment.sourceFrameDataUrl === 'string' ? comment.sourceFrameDataUrl : null,
    screenshotMime: comment.screenshotMime || null, annotations: Array.isArray(comment.annotations) ? comment.annotations : [],
  })) : [];
  state.source = data.source || null;
  applyPremiereSettings(data.premiereSettings || {});
  renderComments();
  if ((state.source?.type === 'url' || state.source?.type === 'yandex') && state.source.url) {
    els.videoUrl.value = state.source.url;
    void openVideoUrl(state.source.url, false);
  } else if (state.source?.type === 'local') showToast('Проект загружен. Выберите локальное видео повторно');
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (raw) applyImportedData(JSON.parse(raw));
  } catch (error) { console.warn('Не удалось восстановить проект', error); }
}

function activatePlayer() {
  els.playerCard.classList.remove('hidden');
  els.editorCard.classList.remove('hidden');
  els.videoEmpty.classList.add('hidden');
  syncAnnotationCanvas();
}

function openLocalFile(file) {
  remoteLoadId += 1;
  setRemoteLoading(false);
  if (!file || !file.type.startsWith('video/')) return showToast('Выберите видеофайл');
  clearAnnotations();
  if (state.source?.objectUrl) URL.revokeObjectURL(state.source.objectUrl);
  const objectUrl = URL.createObjectURL(file);
  state.source = { type: 'local', name: file.name, size: file.size, objectUrl };
  els.video.crossOrigin = '';
  els.video.src = objectUrl;
  els.video.load();
  activatePlayer();
  saveLocal();
  showToast(`Открыто: ${file.name}`);
}

function isYandexDiskUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)disk\.yandex\.(ru|com|kz|by)$/.test(host) || host === 'yadi.sk' || host.endsWith('.yadi.sk');
  } catch { return false; }
}

function setRemoteLoading(isLoading) {
  els.loadUrlBtn.disabled = isLoading;
  els.videoUrl.disabled = isLoading;
  els.loadUrlBtn.textContent = isLoading ? 'Подключаем…' : 'Открыть';
}

function getApiBaseUrl() {
  try {
    const value = String(window.VIDEO_REVIEW_CONFIG?.apiBaseUrl || '').trim().replace(/\/+$/, '');
    if (!value) return '';
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().replace(/\/+$/, '') : '';
  } catch { return ''; }
}

function buildApiUrl(path, params = {}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('Не настроен Cloudflare Worker для Яндекс Диска');
  const url = new URL(path.replace(/^\//, ''), `${base}/`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

async function resolveYandexDiskVideo(publicUrl) {
  const response = await fetch(buildApiUrl('/api/yandex', { public_key: publicUrl }), { headers: { Accept: 'application/json' }, referrerPolicy: 'no-referrer' });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || `Ошибка API (${response.status})`);
  if (data.type === 'dir') throw new Error('Нужна ссылка на конкретный видеофайл, не на папку');
  return { playbackUrl: buildApiUrl('/api/media', { public_key: publicUrl }), name: data.name || 'Видео с Яндекс Диска', size: Number(data.size) || null, mimeType: data.mime_type || null };
}

function applyRemoteVideo(src, source, message) {
  clearAnnotations();
  if (state.source?.objectUrl) URL.revokeObjectURL(state.source.objectUrl);
  state.source = source;
  els.video.pause();
  els.video.crossOrigin = 'anonymous';
  els.video.src = src;
  els.video.load();
  activatePlayer();
  saveLocal();
  if (message) showToast(message);
}

async function openVideoUrl(url, notify = true) {
  const clean = String(url || '').trim();
  if (!clean) return showToast('Вставьте ссылку на видео');
  try { new URL(clean); } catch { return showToast('Ссылка выглядит некорректно'); }
  const loadId = ++remoteLoadId;
  if (!isYandexDiskUrl(clean)) return applyRemoteVideo(clean, { type: 'url', url: clean }, notify ? 'Видео загружается по ссылке' : '');
  setRemoteLoading(true);
  if (notify) showToast('Получаем видео с Яндекс Диска');
  try {
    const resolved = await resolveYandexDiskVideo(clean);
    if (loadId !== remoteLoadId) return;
    applyRemoteVideo(resolved.playbackUrl, { type: 'yandex', url: clean, name: resolved.name, size: resolved.size, mimeType: resolved.mimeType }, notify ? `Открыто: ${resolved.name}` : '');
  } catch (error) {
    if (loadId === remoteLoadId) showToast(error.message || 'Не удалось открыть видео с Яндекс Диска');
  } finally { if (loadId === remoteLoadId) setRemoteLoading(false); }
}

function updatePlayerUi() {
  const current = els.video.currentTime || 0;
  const duration = els.video.duration || 0;
  els.currentTimeBtn.textContent = formatTime(current, true);
  els.timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  els.timeline.max = duration || 100;
  els.timeline.value = current;
  els.playBtn.textContent = els.video.paused ? '▶' : 'Ⅱ';
}

function togglePlay() {
  if (!els.video.src) return;
  if (els.video.paused) els.video.play().catch(() => showToast('Браузер не смог запустить видео')); else els.video.pause();
}

function seekTo(seconds) {
  if (!Number.isFinite(seconds) || !els.video.src) return;
  const duration = Number.isFinite(els.video.duration) ? els.video.duration : seconds;
  els.video.currentTime = Math.min(Math.max(0, seconds), duration);
  updatePlayerUi();
}

function drawAnnotationsOnFrame(ctx, width, height, strokes = state.annotation.strokes) {
  strokes.forEach((stroke) => {
    if (!stroke.points?.length) return;
    ctx.strokeStyle = stroke.color || '#ff2d2d';
    ctx.fillStyle = stroke.color || '#ff2d2d';
    ctx.lineWidth = Math.max(1, (Number(stroke.size) || 4) * width / Math.max(1, getVideoDisplayRect().width));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    stroke.points.forEach((point, index) => { const x = point.x * width; const y = point.y * height; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    if (stroke.points.length === 1) { const p = stroke.points[0]; ctx.beginPath(); ctx.arc(p.x * width, p.y * height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
  });
}

async function captureFrame(includeAnnotations) {
  if (!els.video.src || els.video.readyState < 2) throw new Error('Кадр пока недоступен');
  const sourceWidth = els.video.videoWidth || 0;
  const sourceHeight = els.video.videoHeight || 0;
  if (!sourceWidth || !sourceHeight) throw new Error('Не удалось определить размер видео');
  const ratio = Math.min(1, 1600 / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(els.video, 0, 0, width, height);
  if (includeAnnotations && state.annotation.strokes.length) drawAnnotationsOnFrame(ctx, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', .9), width, height };
}

async function addComment() {
  const text = els.commentText.value.trim();
  if (!els.video.src) return showToast('Сначала откройте видео');
  if (!text) { showToast('Напишите текст правки'); els.commentText.focus(); return; }
  let screenshotDataUrl = null;
  let sourceFrameDataUrl = null;
  let screenshotWidth = null;
  let screenshotHeight = null;
  const annotations = deepCopy(state.annotation.strokes);
  if (els.attachScreenshot.checked) {
    try {
      const raw = await captureFrame(false);
      const annotated = annotations.length ? await captureFrame(true) : raw;
      sourceFrameDataUrl = raw.dataUrl;
      screenshotDataUrl = annotated.dataUrl;
      screenshotWidth = annotated.width; screenshotHeight = annotated.height;
    } catch (error) { console.warn(error); showToast('Правка сохранится без кадра: браузер заблокировал захват'); }
  }
  state.comments.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    time: Number((els.video.currentTime || 0).toFixed(3)), durationSeconds: Math.max(.04, Number(els.commentDuration.value) || 2),
    type: els.commentType.value, text, author: els.authorName.value.trim() || 'Без имени', status: 'open', createdAt: new Date().toISOString(),
    screenshotDataUrl, sourceFrameDataUrl, screenshotMime: screenshotDataUrl ? 'image/jpeg' : null, screenshotWidth, screenshotHeight, annotations,
  });
  els.commentText.value = '';
  renderComments(); saveLocal(); clearAnnotations(); setDrawMode(false); showToast('Правка добавлена'); els.commentText.focus();
}

function getSortedComments() { return [...state.comments].sort((a, b) => a.time - b.time); }
function getVisibleComments() {
  const type = els.typeFilter.value; const status = els.statusFilter.value;
  return [...state.comments].filter((c) => type === 'all' || c.type === type).filter((c) => status === 'all' || c.status === status).sort((a, b) => state.sortAsc ? a.time - b.time : b.time - a.time);
}
function screenshotFilename(comment, index) { return `${String(index + 1).padStart(3, '0')}_${formatTime(comment.time, true).replaceAll(':', '-').replace('.', '-')}.jpg`; }

function renderMarkers() {
  els.markers.innerHTML = '';
  const duration = els.video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  state.comments.forEach((comment) => {
    const marker = document.createElement('button'); marker.type = 'button'; marker.className = `marker ${comment.status === 'done' ? 'done' : ''}`;
    marker.style.left = `${Math.min(100, Math.max(0, comment.time / duration * 100))}%`; marker.title = `${formatTime(comment.time, true)} — ${comment.text}`;
    marker.addEventListener('click', () => seekTo(comment.time)); els.markers.append(marker);
  });
}

function renderComments() {
  const visible = getVisibleComments();
  els.commentsCount.textContent = state.comments.length;
  els.commentsList.querySelectorAll('.comment').forEach((node) => node.remove());
  els.emptyState.classList.toggle('hidden', visible.length > 0);
  visible.forEach((comment) => {
    const item = document.createElement('article'); item.className = `comment ${comment.status === 'done' ? 'done' : ''}`; item.dataset.id = comment.id;
    item.innerHTML = `<div class="comment-top"><div class="comment-meta"><button class="comment-time" data-action="seek">${formatTime(comment.time, true)}</button><span class="comment-type">${escapeHtml(comment.type)}</span></div><div class="comment-actions"><button class="icon-btn" data-action="edit" title="Редактировать">✎</button><button class="icon-btn" data-action="delete" title="Удалить">×</button></div></div><div class="comment-text">${escapeHtml(comment.text)}</div>`;
    if (comment.screenshotDataUrl) {
      const index = getSortedComments().findIndex((entry) => entry.id === comment.id);
      const shot = document.createElement('div'); shot.className = 'comment-shot';
      shot.innerHTML = `<button type="button" class="comment-shot-thumb" data-action="view-image"><img alt="Скриншот правки ${formatTime(comment.time, true)}" loading="lazy" src="${comment.screenshotDataUrl}"></button><div class="comment-shot-actions"><button class="btn btn-ghost" type="button" data-action="view-image">Открыть кадр</button><button class="btn btn-ghost" type="button" data-action="download-image">Скачать кадр</button><span class="comment-shot-meta">${comment.annotations?.length ? 'С пометками' : 'Без пометок'} · ${escapeHtml(screenshotFilename(comment, Math.max(0, index)))}</span></div>`;
      item.append(shot);
    }
    const bottom = document.createElement('div'); bottom.className = 'comment-bottom';
    bottom.innerHTML = `<span>${escapeHtml(comment.author)} · ${new Date(comment.createdAt).toLocaleString('ru-RU')} · оверлей ${Number(comment.durationSeconds || 2).toFixed(1)} сек.</span><label class="status-toggle"><input type="checkbox" data-action="status" ${comment.status === 'done' ? 'checked' : ''}>Готово</label>`;
    item.append(bottom); item.addEventListener('click', (event) => handleCommentAction(event, comment.id)); els.commentsList.append(item);
  });
  renderMarkers();
}

function openImagePreview(comment) {
  if (!comment?.screenshotDataUrl) return;
  state.previewCommentId = comment.id; els.imagePreview.src = comment.screenshotDataUrl; els.imagePreviewTitle.textContent = `${formatTime(comment.time, true)} · ${comment.type}`; els.imagePreviewDialog.showModal();
}
function downloadDataUrl(dataUrl, filename) { const link = document.createElement('a'); link.href = dataUrl; link.download = filename; document.body.append(link); link.click(); link.remove(); }
function downloadSingleScreenshot(comment) { const index = getSortedComments().findIndex((item) => item.id === comment.id); downloadDataUrl(comment.screenshotDataUrl, screenshotFilename(comment, Math.max(0, index))); }

function handleCommentAction(event, id) {
  const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return;
  const comment = state.comments.find((item) => item.id === id); if (!comment) return;
  if (action === 'seek') seekTo(comment.time);
  if (action === 'delete') { state.comments = state.comments.filter((item) => item.id !== id); renderComments(); saveLocal(); showToast('Правка удалена'); }
  if (action === 'status') { comment.status = event.target.checked ? 'done' : 'open'; renderComments(); saveLocal(); }
  if (action === 'edit') { const next = prompt('Измените текст правки:', comment.text); if (next === null) return; const value = next.trim(); if (!value) return showToast('Текст не может быть пустым'); comment.text = value; renderComments(); saveLocal(); }
  if (action === 'view-image') openImagePreview(comment);
  if (action === 'download-image') downloadSingleScreenshot(comment);
}

function buildText() {
  const lines = [els.projectName.value.trim() || 'Проект без названия', `Правок: ${state.comments.length}`, ''];
  getSortedComments().forEach((c, i) => { lines.push(`${i + 1}. ${c.status === 'done' ? '✓' : '○'} ${formatTime(c.time, true)} · ${c.type}`); lines.push(c.text); lines.push(`Автор: ${c.author}`); lines.push(''); });
  return lines.join('\n');
}
function buildCsv() {
  const rows = [['№','Таймкод','Секунды','Длительность','Тип','Правка','Автор','Статус','Создано'], ...getSortedComments().map((c, i) => [i + 1, formatTime(c.time, true), c.time, c.durationSeconds || 2, c.type, c.text, c.author, c.status === 'done' ? 'Выполнено' : 'Открыто', new Date(c.createdAt).toLocaleString('ru-RU')])];
  const esc = (v) => `"${String(v).replaceAll('"','""')}"`; return '\uFEFF' + rows.map((row) => row.map(esc).join(';')).join('\n');
}
function buildHtmlReport() {
  const title = escapeHtml(els.projectName.value.trim() || 'Проект без названия');
  const items = getSortedComments().map((c, i) => `<article><h2>#${i + 1} · ${formatTime(c.time,true)} · ${escapeHtml(c.type)}</h2><p>${escapeHtml(c.text).replaceAll('\n','<br>')}</p><small>${escapeHtml(c.author)} · ${c.status === 'done' ? 'Выполнено' : 'Открыто'}</small>${c.screenshotDataUrl ? `<img src="screenshots/${screenshotFilename(c,i)}" alt="Кадр">` : ''}</article>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial;margin:24px;background:#f5f6f8;color:#17191c}main{max-width:1000px;margin:auto}article{background:#fff;border-radius:14px;padding:18px;margin:14px 0}h2{font-size:18px}p{line-height:1.5}small{color:#69707a}img{max-width:100%;display:block;margin-top:14px;border-radius:10px}</style></head><body><main><h1>${title}</h1>${items}</main></body></html>`;
}

function download(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeFilename(ext) { return `${sanitizeFilename(els.projectName.value.trim() || 'pravochnaya', 'pravochnaya')}.${ext}`; }
function dataUrlBytes(dataUrl) { const base64 = String(dataUrl).split(',')[1] || ''; const binary = atob(base64); const bytes = new Uint8Array(binary.length); for (let i=0;i<binary.length;i+=1) bytes[i]=binary.charCodeAt(i); return bytes; }

async function exportReportZip() {
  if (!state.comments.length) return showToast('Добавьте хотя бы одну правку');
  showToast('Собираем ZIP-отчёт…');
  const files = [
    { name: 'project.json', data: JSON.stringify(projectSnapshot(), null, 2) }, { name: 'comments.csv', data: buildCsv() }, { name: 'comments.txt', data: buildText() }, { name: 'report.html', data: buildHtmlReport() },
  ];
  getSortedComments().forEach((c, i) => { if (c.screenshotDataUrl) files.push({ name: `screenshots/${screenshotFilename(c,i)}`, data: dataUrlBytes(c.screenshotDataUrl) }); });
  const blob = await buildZip(files); download(blob, safeFilename('zip'), 'application/zip'); showToast('ZIP-отчёт подготовлен');
}

function setPremiereProgress(percent, text) {
  els.premiereProgress.classList.remove('hidden'); els.premiereProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`; els.premiereProgressText.textContent = text;
}
function updateCustomResolutionVisibility() { const custom = els.premiereResolution.value === 'custom'; els.premiereWidthField.classList.toggle('hidden', !custom); els.premiereHeightField.classList.toggle('hidden', !custom); }
function openPremiereDialog() {
  if (!state.comments.length) return showToast('Добавьте хотя бы одну правку');
  els.exportDialog.close(); els.premiereCommentsCount.textContent = state.comments.length; els.premiereProgress.classList.add('hidden'); els.premiereProgressBar.style.width = '0%'; els.premiereDialog.showModal();
}

async function exportPremiere() {
  if (state.premiereExporting) return;
  let settings;
  try { settings = buildExportSettings(getPremiereSettingsRaw()); } catch (error) { return showToast(error.message); }
  const snapshot = projectSnapshot();
  const project = normalizeProject(snapshot);
  if (!project.comments.length) return showToast('Нет правок для экспорта');
  state.premiereExporting = true; els.premiereExportBtn.disabled = true; els.premiereCancelBtn.disabled = true;
  try {
    setPremiereProgress(3, 'Подготавливаем таймлайн…');
    const prepared = prepareTimeline(project, settings);
    const files = [];
    for (let i = 0; i < prepared.items.length; i += 1) {
      const item = prepared.items[i];
      setPremiereProgress(5 + i / Math.max(1, prepared.items.length) * 66, `PNG ${i + 1} из ${prepared.items.length}: ${item.type}`);
      const rendered = await renderOverlay(item, settings);
      files.push({ name: item.filename, data: rendered.blob });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const xml = buildPremiereXml(project, settings, prepared);
    files.unshift(
      { name: 'pravochnaya-premiere.xml', data: xml },
      { name: 'README-ПРЕМЬЕР.txt', data: buildImportReadme(project, settings, prepared) },
      { name: 'manifest.csv', data: buildManifestCsv(project, settings, prepared) },
      { name: 'manifest.json', data: JSON.stringify({
        project: project.projectName, settings, tracks: prepared.tracks.length,
        comments: prepared.items.map(({ screenshotDataUrl, sourceFrameDataUrl, annotations, ...item }) => ({ ...item, annotationsCount: annotations?.length || 0 })),
      }, null, 2) },
      { name: 'project.json', data: JSON.stringify(snapshot, null, 2) },
    );
    setPremiereProgress(76, 'Собираем ZIP…');
    const zip = await buildZip(files, (progress) => setPremiereProgress(76 + progress * 24, 'Собираем ZIP…'));
    download(zip, `${sanitizeFilename(project.projectName, 'pravochnaya')}-premiere.zip`, 'application/zip');
    setPremiereProgress(100, `Готово: ${prepared.items.length} правок, ${prepared.tracks.length} PNG-дорожек`);
    saveLocal(); showToast('ZIP для Adobe Premiere Pro готов');
  } catch (error) { console.error(error); showToast(error.message || 'Не удалось создать проект Premiere'); }
  finally { state.premiereExporting = false; els.premiereExportBtn.disabled = false; els.premiereCancelBtn.disabled = false; }
}

function importProject(file) {
  const reader = new FileReader(); reader.onload = () => { try { applyImportedData(JSON.parse(reader.result)); saveLocal(); showToast('Проект импортирован'); } catch { showToast('Не удалось прочитать JSON-проект'); } }; reader.readAsText(file);
}
function resetProject() {
  remoteLoadId += 1; setRemoteLoading(false); if (!confirm('Создать новый проект? Текущие правки будут удалены из браузера.')) return;
  if (state.source?.objectUrl) URL.revokeObjectURL(state.source.objectUrl);
  state.comments=[]; state.source=null; els.projectName.value=''; els.authorName.value=''; els.videoUrl.value=''; els.commentText.value=''; els.video.pause(); els.video.removeAttribute('src'); els.video.load();
  els.playerCard.classList.add('hidden'); els.editorCard.classList.add('hidden'); clearAnnotations(); setDrawMode(false); localStorage.removeItem(STORAGE_KEY); LEGACY_STORAGE_KEYS.forEach((key)=>localStorage.removeItem(key)); renderComments(); showToast('Новый проект создан');
}

function exportProject(format) {
  if (format === 'premiere') return openPremiereDialog();
  if (format === 'json') download(JSON.stringify(projectSnapshot(), null, 2), safeFilename('json'), 'application/json');
  if (format === 'csv') download(buildCsv(), safeFilename('csv'), 'text/csv;charset=utf-8');
  if (format === 'txt') download(buildText(), safeFilename('txt'), 'text/plain;charset=utf-8');
  if (format === 'zip') { els.exportDialog.close(); void exportReportZip(); return; }
  els.exportDialog.close(); showToast('Файл подготовлен');
}

$$('.tab').forEach((tab) => tab.addEventListener('click', () => { $$('.tab').forEach((node)=>node.classList.remove('active')); $$('.source-panel').forEach((node)=>node.classList.remove('active')); tab.classList.add('active'); $(`[data-source-panel="${tab.dataset.sourceTab}"]`).classList.add('active'); }));
els.localVideoInput.addEventListener('change', (event) => openLocalFile(event.target.files[0]));
els.dropzone.addEventListener('dragover',(event)=>{event.preventDefault();els.dropzone.classList.add('dragover')}); els.dropzone.addEventListener('dragleave',()=>els.dropzone.classList.remove('dragover')); els.dropzone.addEventListener('drop',(event)=>{event.preventDefault();els.dropzone.classList.remove('dragover');openLocalFile(event.dataTransfer.files[0])});
els.loadUrlBtn.addEventListener('click',()=>void openVideoUrl(els.videoUrl.value)); els.videoUrl.addEventListener('keydown',(event)=>{if(event.key==='Enter')void openVideoUrl(els.videoUrl.value)});
els.video.addEventListener('loadedmetadata',()=>{syncAnnotationCanvas();updatePlayerUi();renderMarkers()}); els.video.addEventListener('loadeddata',syncAnnotationCanvas); els.video.addEventListener('timeupdate',updatePlayerUi); els.video.addEventListener('play',updatePlayerUi); els.video.addEventListener('pause',updatePlayerUi); els.video.addEventListener('click',()=>{if(!state.annotation.enabled)togglePlay()}); els.video.addEventListener('error',()=>showToast(state.source?.type==='yandex'?'Видео с Яндекс Диска не открылось':'Видео не открылось. Проверьте формат или CORS'));
els.playBtn.addEventListener('click',togglePlay); els.backBtn.addEventListener('click',()=>seekTo((els.video.currentTime||0)-5)); els.forwardBtn.addEventListener('click',()=>seekTo((els.video.currentTime||0)+5)); els.timeline.addEventListener('input',()=>seekTo(Number(els.timeline.value))); els.muteBtn.addEventListener('click',()=>{els.video.muted=!els.video.muted;els.muteBtn.textContent=els.video.muted?'🔇':'🔊'}); els.volume.addEventListener('input',()=>{els.video.volume=Number(els.volume.value);els.video.muted=els.video.volume===0;els.muteBtn.textContent=els.video.muted?'🔇':'🔊'}); els.fullscreenBtn.addEventListener('click',()=>{if(!document.fullscreenElement)els.playerCard.requestFullscreen?.();else document.exitFullscreen?.()});
els.currentTimeBtn.addEventListener('click',()=>{const next=prompt('Введите таймкод:',formatTime(els.video.currentTime||0,true));if(next===null)return;const seconds=parseVideoTimecode(next);if(seconds===null)showToast('Не удалось распознать таймкод');else seekTo(seconds)});
els.drawToggleBtn.addEventListener('click',()=>setDrawMode(!state.annotation.enabled)); els.drawColor.addEventListener('input',()=>{state.annotation.color=els.drawColor.value}); els.drawSize.addEventListener('input',()=>{state.annotation.size=Number(els.drawSize.value)}); els.undoDrawBtn.addEventListener('click',undoAnnotation); els.clearDrawBtn.addEventListener('click',()=>clearAnnotations(true)); els.annotationCanvas.addEventListener('pointerdown',beginStroke); els.annotationCanvas.addEventListener('pointermove',extendStroke); els.annotationCanvas.addEventListener('pointerup',endStroke); els.annotationCanvas.addEventListener('pointercancel',endStroke); els.annotationCanvas.addEventListener('pointerleave',(event)=>{if(state.annotation.pointerId===event.pointerId&&state.annotation.currentStroke)endStroke(event)});
els.addCommentBtn.addEventListener('click',()=>void addComment()); els.commentText.addEventListener('keydown',(event)=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter')void addComment()}); [els.projectName,els.authorName].forEach((input)=>input.addEventListener('input',saveLocal)); els.typeFilter.addEventListener('change',renderComments); els.statusFilter.addEventListener('change',renderComments); els.sortBtn.addEventListener('click',()=>{state.sortAsc=!state.sortAsc;renderComments()});
els.copyTextBtn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(buildText());showToast('Список правок скопирован')}catch{showToast('Не удалось скопировать')}}); els.exportCsvBtn.addEventListener('click',()=>exportProject('csv')); els.exportBtn.addEventListener('click',()=>els.exportDialog.showModal()); $$('[data-export]').forEach((button)=>button.addEventListener('click',()=>exportProject(button.dataset.export))); els.importBtn.addEventListener('click',()=>els.importInput.click()); els.importInput.addEventListener('change',(event)=>{if(event.target.files[0])importProject(event.target.files[0]);event.target.value=''}); els.newProjectBtn.addEventListener('click',resetProject);
els.closePreviewBtn.addEventListener('click',()=>els.imagePreviewDialog.close()); els.downloadPreviewImageBtn.addEventListener('click',()=>{const comment=state.comments.find((item)=>item.id===state.previewCommentId);if(comment)downloadSingleScreenshot(comment)});
els.premiereResolution.addEventListener('change',()=>{updateCustomResolutionVisibility();saveLocal()}); [els.premiereFps,els.premiereWidth,els.premiereHeight,els.premiereStartTimecode,els.premiereOverlayDuration,els.premiereOverlayStyle,els.premiereThumbnailPosition].forEach((input)=>input.addEventListener('change',saveLocal)); els.premiereCancelBtn.addEventListener('click',()=>els.premiereDialog.close()); els.premiereExportBtn.addEventListener('click',()=>void exportPremiere());
document.addEventListener('keydown',(event)=>{const tag=document.activeElement?.tagName;const typing=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';if(typing)return;if(event.code==='Space'){event.preventDefault();togglePlay()}if(event.key.toLowerCase()==='m'){els.video.pause();els.commentText.focus()}if(event.key==='ArrowLeft')seekTo((els.video.currentTime||0)-(event.shiftKey?5:1));if(event.key==='ArrowRight')seekTo((els.video.currentTime||0)+(event.shiftKey?5:1))});
window.addEventListener('resize',syncAnnotationCanvas); if(window.ResizeObserver)new ResizeObserver(syncAnnotationCanvas).observe(els.videoWrap);

state.annotation.color=els.drawColor.value; state.annotation.size=Number(els.drawSize.value); setDrawMode(false); applyPremiereSettings({}); loadLocal(); renderComments(); updatePlayerUi(); syncAnnotationCanvas(); updateCustomResolutionVisibility();
