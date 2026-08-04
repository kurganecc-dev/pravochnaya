(() => {
  'use strict';

  const STORAGE_KEY = 'video-review-service-v3';
  const LEGACY_STORAGE_KEYS = ['video-review-service-v2', 'video-review-service-v1'];
  let remoteLoadId = 0;

  const state = {
    comments: [],
    source: null,
    sortAsc: true,
    localSaveWarned: false,
    previewCommentId: null,
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
    projectName: $('#projectName'),
    authorName: $('#authorName'),
    localVideoInput: $('#localVideoInput'),
    dropzone: $('#dropzone'),
    videoUrl: $('#videoUrl'),
    loadUrlBtn: $('#loadUrlBtn'),
    sourceCard: $('#sourceCard'),
    playerCard: $('#playerCard'),
    editorCard: $('#editorCard'),
    videoWrap: $('#videoWrap'),
    video: $('#video'),
    annotationCanvas: $('#annotationCanvas'),
    videoEmpty: $('#videoEmpty'),
    timeline: $('#timeline'),
    markers: $('#markers'),
    playBtn: $('#playBtn'),
    backBtn: $('#backBtn'),
    forwardBtn: $('#forwardBtn'),
    muteBtn: $('#muteBtn'),
    volume: $('#volume'),
    fullscreenBtn: $('#fullscreenBtn'),
    timeLabel: $('#timeLabel'),
    currentTimeBtn: $('#currentTimeBtn'),
    commentType: $('#commentType'),
    commentText: $('#commentText'),
    addCommentBtn: $('#addCommentBtn'),
    attachScreenshot: $('#attachScreenshot'),
    drawToggleBtn: $('#drawToggleBtn'),
    drawColor: $('#drawColor'),
    drawSize: $('#drawSize'),
    undoDrawBtn: $('#undoDrawBtn'),
    clearDrawBtn: $('#clearDrawBtn'),
    annotationStatus: $('#annotationStatus'),
    commentsCount: $('#commentsCount'),
    commentsList: $('#commentsList'),
    emptyState: $('#emptyState'),
    typeFilter: $('#typeFilter'),
    statusFilter: $('#statusFilter'),
    sortBtn: $('#sortBtn'),
    copyTextBtn: $('#copyTextBtn'),
    exportCsvBtn: $('#exportCsvBtn'),
    exportBtn: $('#exportBtn'),
    exportDialog: $('#exportDialog'),
    importBtn: $('#importBtn'),
    importInput: $('#importInput'),
    newProjectBtn: $('#newProjectBtn'),
    toast: $('#toast'),
    imagePreviewDialog: $('#imagePreviewDialog'),
    imagePreview: $('#imagePreview'),
    imagePreviewTitle: $('#imagePreviewTitle'),
    downloadPreviewImageBtn: $('#downloadPreviewImageBtn'),
    closePreviewBtn: $('#closePreviewBtn'),
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

  function parseTimecode(text) {
    const normalized = String(text).trim().replace(',', '.');
    const parts = normalized.split(':').map(Number);
    if (parts.some(Number.isNaN)) return null;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2300);
  }

  function getCanvasClientSize() {
    return {
      width: Math.max(1, Math.round(els.annotationCanvas.clientWidth || els.video.clientWidth || 1)),
      height: Math.max(1, Math.round(els.annotationCanvas.clientHeight || els.video.clientHeight || 1)),
    };
  }

  function syncAnnotationCanvas() {
    const rect = els.videoWrap.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (els.annotationCanvas.width !== targetWidth || els.annotationCanvas.height !== targetHeight) {
      els.annotationCanvas.width = targetWidth;
      els.annotationCanvas.height = targetHeight;
      redrawAnnotations();
    }
  }

  function getVideoDisplayRect() {
    const { width: boxWidth, height: boxHeight } = getCanvasClientSize();
    const videoWidth = els.video.videoWidth || 16;
    const videoHeight = els.video.videoHeight || 9;
    const videoAspect = videoWidth / videoHeight;
    const boxAspect = boxWidth / boxHeight;

    let width;
    let height;
    let x;
    let y;

    if (boxAspect > videoAspect) {
      height = boxHeight;
      width = height * videoAspect;
      x = (boxWidth - width) / 2;
      y = 0;
    } else {
      width = boxWidth;
      height = width / videoAspect;
      x = 0;
      y = (boxHeight - height) / 2;
    }

    return { x, y, width, height, canvasWidth: boxWidth, canvasHeight: boxHeight };
  }

  function renderStrokeToContext(ctx, stroke, width, height) {
    if (!stroke?.points?.length) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (stroke.points.length === 1) {
      const single = stroke.points[0];
      ctx.arc(single.x * width, single.y * height, Math.max(1, stroke.size / 2), 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  function redrawAnnotations() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = getCanvasClientSize();
    annotationCtx.setTransform(1, 0, 0, 1, 0, 0);
    annotationCtx.clearRect(0, 0, els.annotationCanvas.width, els.annotationCanvas.height);
    annotationCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.annotation.strokes.forEach((stroke) => renderStrokeToContext(annotationCtx, stroke, width, height));
    if (state.annotation.currentStroke) {
      renderStrokeToContext(annotationCtx, state.annotation.currentStroke, width, height);
    }
  }

  function hasAnnotations() {
    return state.annotation.strokes.length > 0;
  }

  function updateAnnotationStatus() {
    const strokes = state.annotation.strokes.length;
    if (state.annotation.enabled) {
      els.annotationStatus.textContent = strokes > 0
        ? `Режим рисования включён · штрихов: ${strokes}`
        : 'Режим рисования включён · рисуйте поверх кадра';
    } else {
      els.annotationStatus.textContent = strokes > 0
        ? `Пометки подготовлены: ${strokes}`
        : 'Рисование выключено';
    }
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
    if (!state.annotation.strokes.length) {
      showToast('Нечего отменять');
      return;
    }
    state.annotation.strokes.pop();
    redrawAnnotations();
    updateAnnotationStatus();
  }

  function getPointerPosition(event) {
    const rect = els.annotationCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  function beginStroke(event) {
    if (!state.annotation.enabled || event.button !== 0) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    state.annotation.pointerId = event.pointerId;
    state.annotation.currentStroke = {
      color: state.annotation.color,
      size: Number(state.annotation.size),
      points: [point],
    };
    els.annotationCanvas.setPointerCapture?.(event.pointerId);
    redrawAnnotations();
  }

  function extendStroke(event) {
    if (!state.annotation.enabled || state.annotation.pointerId !== event.pointerId || !state.annotation.currentStroke) return;
    event.preventDefault();
    state.annotation.currentStroke.points.push(getPointerPosition(event));
    redrawAnnotations();
  }

  function endStroke(event) {
    if (state.annotation.pointerId !== event.pointerId || !state.annotation.currentStroke) return;
    event.preventDefault();
    if (state.annotation.currentStroke.points.length) {
      state.annotation.strokes.push(state.annotation.currentStroke);
    }
    state.annotation.currentStroke = null;
    state.annotation.pointerId = null;
    redrawAnnotations();
    updateAnnotationStatus();
  }

  function projectSnapshot() {
    return {
      version: 2,
      projectName: els.projectName.value.trim(),
      authorName: els.authorName.value.trim(),
      source: state.source ? Object.fromEntries(Object.entries(state.source).filter(([key]) => key !== 'objectUrl')) : null,
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
        showToast('Автосохранение в браузере переполнено. Рекомендуется скачать JSON или ZIP');
      }
    }
  }

  function applyImportedData(data) {
    els.projectName.value = data.projectName || '';
    els.authorName.value = data.authorName || '';
    state.comments = Array.isArray(data.comments) ? data.comments : [];
    state.source = data.source || null;
    renderComments();

    if ((state.source?.type === 'url' || state.source?.type === 'yandex') && state.source.url) {
      els.videoUrl.value = state.source.url;
      openVideoUrl(state.source.url, false);
    } else if (state.source?.type === 'local') {
      showToast('Проект загружен. Выберите локальное видео повторно');
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      if (!raw) return;
      const data = JSON.parse(raw);
      applyImportedData(data);
    } catch (error) {
      console.warn('Не удалось восстановить проект', error);
    }
  }

  function activatePlayer() {
    els.playerCard.classList.remove('hidden');
    els.editorCard.classList.remove('hidden');
    els.videoEmpty.classList.add('hidden');
    syncAnnotationCanvas();
    redrawAnnotations();
  }

  function openLocalFile(file) {
    remoteLoadId += 1;
    setRemoteLoading(false);
    if (!file || !file.type.startsWith('video/')) {
      showToast('Выберите видеофайл');
      return;
    }
    clearAnnotations();
    if (state.source?.objectUrl) URL.revokeObjectURL(state.source.objectUrl);
    const objectUrl = URL.createObjectURL(file);
    state.source = {
      type: 'local',
      name: file.name,
      size: file.size,
      objectUrl,
    };
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
      return /(^|\.)disk\.yandex\.(ru|com|kz|by)$/.test(host)
        || host === 'yadi.sk'
        || host.endsWith('.yadi.sk');
    } catch {
      return false;
    }
  }

  function setRemoteLoading(isLoading, label = 'Открыть') {
    els.loadUrlBtn.disabled = isLoading;
    els.videoUrl.disabled = isLoading;
    els.loadUrlBtn.textContent = isLoading ? 'Подключаем…' : label;
  }

  function normalizeApiBaseUrl(value) {
    const clean = String(value || '').trim().replace(/\/+$/, '');
    if (!clean) return '';
    const url = new URL(clean);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Адрес API должен начинаться с http:// или https://');
    return url.toString().replace(/\/+$/, '');
  }

  function getApiBaseUrl() {
    const configured = window.VIDEO_REVIEW_CONFIG?.apiBaseUrl || '';
    try { return normalizeApiBaseUrl(configured); } catch { return ''; }
  }

  function buildApiUrl(path, params = {}) {
    const base = getApiBaseUrl();
    if (!base) throw new Error('Сначала укажите адрес Cloudflare Worker');
    const url = new URL(path.replace(/^\//, ''), `${base}/`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    return { response, data };
  }

  async function resolveYandexDiskVideo(publicUrl) {
    let result;
    try {
      result = await requestJson(buildApiUrl('/api/yandex', { public_key: publicUrl }), {
        method: 'GET', headers: { Accept: 'application/json' }, referrerPolicy: 'no-referrer',
      });
    } catch (error) {
      console.warn('Worker request failed', error);
      throw new Error(error.message || 'Не удалось подключиться к Cloudflare Worker');
    }
    const { response, data } = result;
    if (!response.ok) {
      const apiMessage = data?.message || data?.description;
      if (response.status === 404) throw new Error('Файл не найден или публичная ссылка больше не действует');
      if (response.status === 403) throw new Error('Нет доступа к файлу. Проверьте, что ссылка публичная');
      if (response.status === 429) throw new Error('Яндекс Диск временно ограничил запросы. Попробуйте позже');
      throw new Error(apiMessage || `Ошибка API (${response.status})`);
    }
    if (data.type === 'dir') throw new Error('Ссылка ведёт на папку. Нужна публичная ссылка на конкретный видеофайл');
    const looksLikeVideo = data.media_type === 'video' || String(data.mime_type || '').startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(data.name || '');
    if (!looksLikeVideo) throw new Error('По этой ссылке найден не видеофайл');
    return {
      playbackUrl: buildApiUrl('/api/media', { public_key: publicUrl }),
      name: data.name || 'Видео с Яндекс Диска', size: Number(data.size) || null, mimeType: data.mime_type || null,
    };
  }

  function applyRemoteVideo(src, source, notifyMessage) {
    clearAnnotations();
    if (state.source?.objectUrl) URL.revokeObjectURL(state.source.objectUrl);
    state.source = source;
    els.video.pause();
    els.video.crossOrigin = source.type === 'local' ? '' : 'anonymous';
    els.video.src = src;
    els.video.load();
    activatePlayer();
    saveLocal();
    if (notifyMessage) showToast(notifyMessage);
  }

  async function openVideoUrl(url, notify = true) {
    const clean = String(url || '').trim();
    if (!clean) {
      showToast('Вставьте ссылку на видео');
      return;
    }
    try {
      new URL(clean);
    } catch {
      showToast('Ссылка выглядит некорректно');
      return;
    }

    const loadId = ++remoteLoadId;
    if (!isYandexDiskUrl(clean)) {
      applyRemoteVideo(clean, { type: 'url', url: clean }, notify ? 'Видео загружается по ссылке' : '');
      return;
    }

    setRemoteLoading(true);
    if (notify) showToast('Получаем видео с Яндекс Диска');
    try {
      const resolved = await resolveYandexDiskVideo(clean);
      if (loadId !== remoteLoadId) return;
      applyRemoteVideo(
        resolved.playbackUrl,
        {
          type: 'yandex',
          url: clean,
          name: resolved.name,
          size: resolved.size,
          mimeType: resolved.mimeType,
        },
        notify ? `Открыто с Яндекс Диска: ${resolved.name}` : '',
      );
    } catch (error) {
      if (loadId !== remoteLoadId) return;
      console.warn('Не удалось открыть видео с Яндекс Диска', error);
      showToast(error.message || 'Не удалось открыть видео с Яндекс Диска');
    } finally {
      if (loadId === remoteLoadId) setRemoteLoading(false);
    }
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
    if (els.video.paused) {
      els.video.play().catch(() => showToast('Браузер не смог запустить видео'));
    } else {
      els.video.pause();
    }
  }

  function seekTo(seconds) {
    if (!Number.isFinite(seconds) || !els.video.src) return;
    const duration = Number.isFinite(els.video.duration) ? els.video.duration : seconds;
    els.video.currentTime = Math.min(Math.max(0, seconds), duration);
    updatePlayerUi();
  }

  function getSortedComments() {
    return [...state.comments].sort((a, b) => a.time - b.time);
  }

  function screenshotExtensionForComment(comment) {
    const mime = comment.screenshotMime || '';
    if (mime.includes('png')) return 'png';
    return 'jpg';
  }

  function screenshotFilename(comment, index) {
    const prefix = String(index + 1).padStart(2, '0');
    const safeTime = formatTime(comment.time, true).replaceAll(':', '-').replace('.', '-');
    return `${prefix}_${safeTime}.${screenshotExtensionForComment(comment)}`;
  }

  function buildExportComments() {
    return getSortedComments().map((comment, index) => ({
      ...comment,
      screenshotFilename: comment.screenshotDataUrl ? screenshotFilename(comment, index) : '',
    }));
  }

  function drawAnnotationsOnExportContext(ctx, outputWidth, outputHeight) {
    const rect = getVideoDisplayRect();
    state.annotation.strokes.forEach((stroke) => {
      const scale = outputWidth / rect.width;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, stroke.size * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const canvasX = point.x * rect.canvasWidth;
        const canvasY = point.y * rect.canvasHeight;
        const mappedX = ((canvasX - rect.x) / rect.width) * outputWidth;
        const mappedY = ((canvasY - rect.y) / rect.height) * outputHeight;
        if (index === 0) ctx.moveTo(mappedX, mappedY);
        else ctx.lineTo(mappedX, mappedY);
      });
      ctx.stroke();
    });
  }

  async function captureAnnotatedFrame() {
    if (!els.video.src || els.video.readyState < 2) {
      throw new Error('Кадр пока недоступен');
    }

    const sourceWidth = els.video.videoWidth || 0;
    const sourceHeight = els.video.videoHeight || 0;
    if (!sourceWidth || !sourceHeight) {
      throw new Error('Не удалось определить размер видео');
    }

    const maxWidth = 1400;
    const ratio = Math.min(1, maxWidth / sourceWidth);
    const outputWidth = Math.max(1, Math.round(sourceWidth * ratio));
    const outputHeight = Math.max(1, Math.round(sourceHeight * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(els.video, 0, 0, outputWidth, outputHeight);
    if (hasAnnotations()) {
      drawAnnotationsOnExportContext(ctx, outputWidth, outputHeight);
    }

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      mimeType: 'image/jpeg',
      width: outputWidth,
      height: outputHeight,
      hasAnnotations: hasAnnotations(),
    };
  }

  async function addComment() {
    const text = els.commentText.value.trim();
    if (!els.video.src) {
      showToast('Сначала откройте видео');
      return;
    }
    if (!text) {
      showToast('Напишите текст правки');
      els.commentText.focus();
      return;
    }

    let screenshotDataUrl = null;
    let screenshotMime = null;
    let screenshotWidth = null;
    let screenshotHeight = null;
    let screenshotHasAnnotations = false;

    if (els.attachScreenshot.checked) {
      try {
        const captured = await captureAnnotatedFrame();
        screenshotDataUrl = captured.dataUrl;
        screenshotMime = captured.mimeType;
        screenshotWidth = captured.width;
        screenshotHeight = captured.height;
        screenshotHasAnnotations = captured.hasAnnotations;
      } catch (error) {
        console.warn('Не удалось сделать скриншот', error);
        showToast('Комментарий сохранён без скриншота. Для ссылочного видео браузер может блокировать захват кадра');
      }
    }

    const comment = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      time: Number((els.video.currentTime || 0).toFixed(3)),
      type: els.commentType.value,
      text,
      author: els.authorName.value.trim() || 'Без имени',
      status: 'open',
      createdAt: new Date().toISOString(),
      screenshotDataUrl,
      screenshotMime,
      screenshotWidth,
      screenshotHeight,
      screenshotHasAnnotations,
      annotations: state.annotation.strokes.map((stroke) => ({
        color: stroke.color,
        size: stroke.size,
        points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
      })),
    };

    state.comments.push(comment);
    els.commentText.value = '';
    renderComments();
    saveLocal();
    clearAnnotations();
    setDrawMode(false);
    showToast('Правка добавлена');
    els.commentText.focus();
  }

  function getVisibleComments() {
    const type = els.typeFilter.value;
    const status = els.statusFilter.value;
    return [...state.comments]
      .filter((comment) => type === 'all' || comment.type === type)
      .filter((comment) => status === 'all' || comment.status === status)
      .sort((a, b) => state.sortAsc ? a.time - b.time : b.time - a.time);
  }

  function renderMarkers() {
    els.markers.innerHTML = '';
    const duration = els.video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;

    state.comments.forEach((comment) => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = `marker ${comment.status === 'done' ? 'done' : ''}`;
      marker.style.left = `${Math.min(100, Math.max(0, (comment.time / duration) * 100))}%`;
      marker.title = `${formatTime(comment.time, true)} — ${comment.text}`;
      marker.addEventListener('click', () => seekTo(comment.time));
      els.markers.append(marker);
    });
  }

  function renderComments() {
    const visible = getVisibleComments();
    const exported = buildExportComments();
    const screenshotNames = new Map(exported.map((comment) => [comment.id, comment.screenshotFilename]));

    els.commentsCount.textContent = state.comments.length;
    els.commentsList.querySelectorAll('.comment').forEach((node) => node.remove());
    els.emptyState.classList.toggle('hidden', visible.length > 0);

    visible.forEach((comment) => {
      const item = document.createElement('article');
      item.className = `comment ${comment.status === 'done' ? 'done' : ''}`;
      item.dataset.id = comment.id;
      item.innerHTML = `
        <div class="comment-top">
          <div class="comment-meta">
            <button class="comment-time" data-action="seek">${formatTime(comment.time, true)}</button>
            <span class="comment-type">${escapeHtml(comment.type)}</span>
          </div>
          <div class="comment-actions">
            <button class="icon-btn" data-action="edit" title="Редактировать">✎</button>
            <button class="icon-btn" data-action="delete" title="Удалить">×</button>
          </div>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>`;

      if (comment.screenshotDataUrl) {
        const shot = document.createElement('div');
        shot.className = 'comment-shot';

        const thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.className = 'comment-shot-thumb';
        thumb.dataset.action = 'view-image';
        thumb.title = 'Открыть скриншот';

        const img = document.createElement('img');
        img.alt = `Скриншот правки ${formatTime(comment.time, true)}`;
        img.loading = 'lazy';
        img.src = comment.screenshotDataUrl;
        thumb.append(img);

        const actions = document.createElement('div');
        actions.className = 'comment-shot-actions';
        actions.innerHTML = `
          <button class="btn btn-ghost" type="button" data-action="view-image">Открыть кадр</button>
          <button class="btn btn-ghost" type="button" data-action="download-image">Скачать кадр</button>
          <span class="comment-shot-meta">${comment.screenshotHasAnnotations ? 'С пометками' : 'Без пометок'}${screenshotNames.get(comment.id) ? ` · ${escapeHtml(screenshotNames.get(comment.id))}` : ''}</span>`;

        shot.append(thumb, actions);
        item.append(shot);
      }

      const bottom = document.createElement('div');
      bottom.className = 'comment-bottom';
      bottom.innerHTML = `
        <span>${escapeHtml(comment.author)} · ${new Date(comment.createdAt).toLocaleString('ru-RU')}</span>
        <label class="status-toggle">
          <input type="checkbox" data-action="status" ${comment.status === 'done' ? 'checked' : ''} />
          Готово
        </label>`;
      item.append(bottom);

      item.addEventListener('click', (event) => handleCommentAction(event, comment.id));
      els.commentsList.append(item);
    });

    renderMarkers();
  }

  function openImagePreview(comment) {
    if (!comment?.screenshotDataUrl) return;
    state.previewCommentId = comment.id;
    els.imagePreview.src = comment.screenshotDataUrl;
    els.imagePreviewTitle.textContent = `${formatTime(comment.time, true)} · ${comment.type}`;
    els.imagePreviewDialog.showModal();
  }

  function downloadSingleScreenshot(comment) {
    if (!comment?.screenshotDataUrl) return;
    const index = getSortedComments().findIndex((item) => item.id === comment.id);
    const baseName = screenshotFilename(comment, Math.max(0, index));
    const link = document.createElement('a');
    link.href = comment.screenshotDataUrl;
    link.download = baseName;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function handleCommentAction(event, id) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const comment = state.comments.find((item) => item.id === id);
    if (!comment) return;

    if (action === 'seek') seekTo(comment.time);

    if (action === 'delete') {
      state.comments = state.comments.filter((item) => item.id !== id);
      renderComments();
      saveLocal();
      showToast('Правка удалена');
    }

    if (action === 'status') {
      comment.status = event.target.checked ? 'done' : 'open';
      renderComments();
      saveLocal();
    }

    if (action === 'edit') {
      const nextText = prompt('Измените текст правки:', comment.text);
      if (nextText === null) return;
      const trimmed = nextText.trim();
      if (!trimmed) {
        showToast('Текст правки не может быть пустым');
        return;
      }
      comment.text = trimmed;
      renderComments();
      saveLocal();
      showToast('Правка обновлена');
    }

    if (action === 'view-image') openImagePreview(comment);
    if (action === 'download-image') downloadSingleScreenshot(comment);
  }

  function buildText() {
    const title = els.projectName.value.trim() || 'Проект без названия';
    const lines = [`${title}`, `Правок: ${state.comments.length}`, ''];
    buildExportComments().forEach((comment, index) => {
      const status = comment.status === 'done' ? '✓' : '○';
      lines.push(`${index + 1}. ${status} ${formatTime(comment.time, true)} · ${comment.type}`);
      lines.push(comment.text);
      lines.push(`Автор: ${comment.author}`);
      if (comment.screenshotFilename) {
        lines.push(`Скриншот: screenshots/${comment.screenshotFilename}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  function buildCsv() {
    const rows = [
      ['№', 'Таймкод', 'Секунды', 'Тип', 'Правка', 'Автор', 'Статус', 'Скриншот', 'Создано'],
      ...buildExportComments().map((comment, index) => [
        index + 1,
        formatTime(comment.time, true),
        comment.time,
        comment.type,
        comment.text,
        comment.author,
        comment.status === 'done' ? 'Выполнено' : 'Открыто',
        comment.screenshotFilename ? `screenshots/${comment.screenshotFilename}` : '',
        new Date(comment.createdAt).toLocaleString('ru-RU'),
      ]),
    ];

    const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
    return '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(';')).join('\n');
  }

  function buildHtmlReport() {
    const title = escapeHtml(els.projectName.value.trim() || 'Проект без названия');
    const author = escapeHtml(els.authorName.value.trim() || '—');
    const items = buildExportComments().map((comment, index) => {
      const screenshot = comment.screenshotFilename
        ? `<img src="screenshots/${escapeHtml(comment.screenshotFilename)}" alt="Скриншот правки ${index + 1}">`
        : '<div class="empty-shot">Нет скриншота</div>';
      return `<article class="item"><div class="meta"><span class="number">#${index + 1}</span><div><strong>${formatTime(comment.time, true)}</strong><div class="type">${escapeHtml(comment.type)}</div></div></div><div class="text">${escapeHtml(comment.text).replaceAll('\n', '<br>')}</div><div class="foot">Автор: ${escapeHtml(comment.author)} · ${comment.status === 'done' ? 'Выполнено' : 'Открыто'}</div><div class="shot">${screenshot}</div></article>`;
    }).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#1b1f24;background:#f5f6f8}main{max-width:980px;margin:auto}h1{margin-bottom:6px}.muted{color:#69707a;margin-bottom:22px}.grid{display:grid;gap:18px}.item{background:white;border:1px solid #dde2e7;border-radius:14px;padding:16px}.meta{display:flex;align-items:center;gap:12px;margin-bottom:10px}.number{min-width:42px;height:42px;border-radius:12px;background:#fff0f1;color:#d71920;display:grid;place-items:center;font-weight:700}.type,.foot{color:#69707a;font-size:13px}.text{line-height:1.5;margin:12px 0}.shot img{max-width:100%;border-radius:12px;border:1px solid #dde2e7}.empty-shot{padding:24px;border-radius:12px;background:#f7f8fa;color:#7a828d;text-align:center}</style></head><body><main><h1>${title}</h1><div class="muted">Автор правок: ${author} · Правок: ${state.comments.length}</div><div class="grid">${items}</div></main></body></html>`;
  }

  function dataUrlBase64(dataUrl) {
    const comma = String(dataUrl || '').indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : '';
  }

  function safeFilename(ext) {
    const base = (els.projectName.value.trim() || 'video-review')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 80);
    return `${base}.${ext}`;
  }

  function download(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportZip() {
    if (typeof window.JSZip !== 'function') { showToast('Модуль ZIP не загрузился. Обновите страницу'); return; }
    const exportButton = $('[data-export="zip"]');
    if (exportButton) exportButton.disabled = true;
    showToast('Собираем ZIP-отчёт…');
    try {
      const zip = new window.JSZip();
      zip.file('project.json', JSON.stringify(projectSnapshot(), null, 2));
      zip.file('comments.csv', buildCsv());
      zip.file('comments.txt', buildText());
      zip.file('report.html', buildHtmlReport());
      const folder = zip.folder('screenshots');
      buildExportComments().forEach((comment) => {
        if (comment.screenshotDataUrl && comment.screenshotFilename) folder.file(comment.screenshotFilename, dataUrlBase64(comment.screenshotDataUrl), { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      download(blob, safeFilename('zip'), 'application/zip');
      showToast('ZIP-отчёт подготовлен');
    } catch (error) {
      console.warn('ZIP export failed', error);
      showToast(error.message || 'Не удалось собрать ZIP-отчёт');
    } finally { if (exportButton) exportButton.disabled = false; }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(buildText());
      showToast('Список правок скопирован');
    } catch {
      showToast('Не удалось скопировать');
    }
  }

  function importProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        applyImportedData(data);
        saveLocal();
      } catch {
        showToast('Не удалось прочитать JSON-проект');
      }
    };
    reader.readAsText(file);
  }

  function resetProject() {
    remoteLoadId += 1;
    setRemoteLoading(false);
    if (!confirm('Создать новый проект? Текущие правки будут удалены из браузера.')) return;
    if (state.source?.objectUrl) URL.revokeObjectURL(state.source.objectUrl);
    state.comments = [];
    state.source = null;
    els.projectName.value = '';
    els.authorName.value = '';
    els.videoUrl.value = '';
    els.commentText.value = '';
    els.attachScreenshot.checked = true;
    els.video.pause();
    els.video.removeAttribute('src');
    els.video.load();
    els.playerCard.classList.add('hidden');
    els.editorCard.classList.add('hidden');
    els.sourceCard.classList.remove('hidden');
    clearAnnotations();
    setDrawMode(false);
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    renderComments();
    showToast('Новый проект создан');
  }

  function exportProject(format) {
    if (format === 'json') {
      const snapshot = projectSnapshot();
      download(JSON.stringify(snapshot, null, 2), safeFilename('json'), 'application/json');
    }
    if (format === 'csv') download(buildCsv(), safeFilename('csv'), 'text/csv;charset=utf-8');
    if (format === 'txt') download(buildText(), safeFilename('txt'), 'text/plain;charset=utf-8');
    if (format === 'zip') {
      els.exportDialog.close();
      exportZip();
      return;
    }
    if (format === 'premiere') {
      els.exportDialog.close();
      window.dispatchEvent(new CustomEvent('pravochnaya:premiere-export'));
      return;
    }
    els.exportDialog.close();
    showToast('Файл подготовлен');
  }

  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((node) => node.classList.remove('active'));
      $$('.source-panel').forEach((node) => node.classList.remove('active'));
      tab.classList.add('active');
      $(`[data-source-panel="${tab.dataset.sourceTab}"]`).classList.add('active');
    });
  });

  els.localVideoInput.addEventListener('change', (event) => openLocalFile(event.target.files[0]));
  els.dropzone.addEventListener('dragover', (event) => { event.preventDefault(); els.dropzone.classList.add('dragover'); });
  els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
  els.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('dragover');
    openLocalFile(event.dataTransfer.files[0]);
  });

  els.loadUrlBtn.addEventListener('click', () => openVideoUrl(els.videoUrl.value));
  els.videoUrl.addEventListener('keydown', (event) => { if (event.key === 'Enter') openVideoUrl(els.videoUrl.value); });

  els.video.addEventListener('loadedmetadata', () => {
    syncAnnotationCanvas();
    updatePlayerUi();
    renderMarkers();
  });
  els.video.addEventListener('loadeddata', syncAnnotationCanvas);
  els.video.addEventListener('timeupdate', updatePlayerUi);
  els.video.addEventListener('play', updatePlayerUi);
  els.video.addEventListener('pause', updatePlayerUi);
  els.video.addEventListener('click', () => { if (!state.annotation.enabled) togglePlay(); });
  els.video.addEventListener('error', () => {
    const message = state.source?.type === 'yandex'
      ? 'Видео с Яндекс Диска не открылось. Возможно, формат не поддерживается браузером или ссылка истекла'
      : 'Видео не открылось. Проверьте ссылку, формат или CORS';
    showToast(message);
  });

  els.playBtn.addEventListener('click', togglePlay);
  els.backBtn.addEventListener('click', () => seekTo((els.video.currentTime || 0) - 5));
  els.forwardBtn.addEventListener('click', () => seekTo((els.video.currentTime || 0) + 5));
  els.timeline.addEventListener('input', () => seekTo(Number(els.timeline.value)));
  els.muteBtn.addEventListener('click', () => {
    els.video.muted = !els.video.muted;
    els.muteBtn.textContent = els.video.muted ? '🔇' : '🔊';
  });
  els.volume.addEventListener('input', () => {
    els.video.volume = Number(els.volume.value);
    els.video.muted = els.video.volume === 0;
    els.muteBtn.textContent = els.video.muted ? '🔇' : '🔊';
  });
  els.fullscreenBtn.addEventListener('click', () => {
    const target = els.playerCard;
    if (!document.fullscreenElement) target.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  els.currentTimeBtn.addEventListener('click', () => {
    const next = prompt('Введите таймкод (например 01:23.500):', formatTime(els.video.currentTime || 0, true));
    if (next === null) return;
    const seconds = parseTimecode(next);
    if (seconds === null) showToast('Не удалось распознать таймкод');
    else seekTo(seconds);
  });

  els.drawToggleBtn.addEventListener('click', () => setDrawMode(!state.annotation.enabled));
  els.drawColor.addEventListener('input', () => { state.annotation.color = els.drawColor.value; });
  els.drawSize.addEventListener('input', () => { state.annotation.size = Number(els.drawSize.value); });
  els.undoDrawBtn.addEventListener('click', undoAnnotation);
  els.clearDrawBtn.addEventListener('click', () => clearAnnotations(true));

  els.annotationCanvas.addEventListener('pointerdown', beginStroke);
  els.annotationCanvas.addEventListener('pointermove', extendStroke);
  els.annotationCanvas.addEventListener('pointerup', endStroke);
  els.annotationCanvas.addEventListener('pointercancel', endStroke);
  els.annotationCanvas.addEventListener('pointerleave', (event) => {
    if (state.annotation.pointerId === event.pointerId && state.annotation.currentStroke) {
      endStroke(event);
    }
  });

  els.addCommentBtn.addEventListener('click', () => {
    void addComment();
  });
  els.commentText.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      void addComment();
    }
  });

  [els.projectName, els.authorName].forEach((input) => input.addEventListener('input', saveLocal));
  els.typeFilter.addEventListener('change', renderComments);
  els.statusFilter.addEventListener('change', renderComments);
  els.sortBtn.addEventListener('click', () => { state.sortAsc = !state.sortAsc; renderComments(); });

  els.copyTextBtn.addEventListener('click', copyText);
  els.exportCsvBtn.addEventListener('click', () => exportProject('csv'));
  els.exportBtn.addEventListener('click', () => els.exportDialog.showModal());
  $$('[data-export]').forEach((button) => button.addEventListener('click', () => exportProject(button.dataset.export)));

  els.importBtn.addEventListener('click', () => els.importInput.click());
  els.importInput.addEventListener('change', (event) => {
    if (event.target.files[0]) importProject(event.target.files[0]);
    event.target.value = '';
  });
  els.newProjectBtn.addEventListener('click', resetProject);

  els.closePreviewBtn.addEventListener('click', () => els.imagePreviewDialog.close());
  els.downloadPreviewImageBtn.addEventListener('click', () => {
    const comment = state.comments.find((item) => item.id === state.previewCommentId);
    if (comment) downloadSingleScreenshot(comment);
  });

  document.addEventListener('keydown', (event) => {
    if (els.imagePreviewDialog.open && event.key === 'Escape') return;
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (typing) return;

    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay();
    }
    if (event.key.toLowerCase() === 'm') {
      els.video.pause();
      els.commentText.focus();
    }
    if (event.key === 'ArrowLeft') seekTo((els.video.currentTime || 0) - (event.shiftKey ? 5 : 1));
    if (event.key === 'ArrowRight') seekTo((els.video.currentTime || 0) + (event.shiftKey ? 5 : 1));
  });

  window.addEventListener('resize', syncAnnotationCanvas);
  if (window.ResizeObserver) {
    new ResizeObserver(() => syncAnnotationCanvas()).observe(els.videoWrap);
  }

  state.annotation.color = els.drawColor.value;
  state.annotation.size = Number(els.drawSize.value);
  setDrawMode(false);
  loadLocal();
  renderComments();
  updatePlayerUi();
  syncAnnotationCanvas();

  window.PRAVOCHNAYA_API = Object.freeze({
    getProjectSnapshot: () => JSON.parse(JSON.stringify(projectSnapshot())),
    getVideoInfo: () => ({
      width: Number(els.video.videoWidth) || 0,
      height: Number(els.video.videoHeight) || 0,
      duration: Number.isFinite(els.video.duration) ? els.video.duration : 0,
    }),
    showToast,
  });
})();
