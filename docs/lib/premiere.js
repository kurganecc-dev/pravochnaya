const FPS_PRESETS = {
  '23.976': { fps: 24000 / 1001, timebase: 24, ntsc: true },
  '24': { fps: 24, timebase: 24, ntsc: false },
  '25': { fps: 25, timebase: 25, ntsc: false },
  '29.97': { fps: 30000 / 1001, timebase: 30, ntsc: true },
  '30': { fps: 30, timebase: 30, ntsc: false },
  '50': { fps: 50, timebase: 50, ntsc: false },
  '59.94': { fps: 60000 / 1001, timebase: 60, ntsc: true },
  '60': { fps: 60, timebase: 60, ntsc: false },
};

export function getRate(value = '25') {
  const key = String(value);
  const preset = FPS_PRESETS[key];
  if (!preset) throw new Error(`Неподдерживаемая частота кадров: ${value}`);
  return { key, ...preset };
}

export function secondsToFrames(seconds, fpsValue = '25') {
  const { fps } = getRate(fpsValue);
  const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  return Math.round(safe * fps);
}

export function framesToTimecode(frames, fpsValue = '25', startFrame = 0) {
  const { timebase } = getRate(fpsValue);
  let total = Math.max(0, Math.round(Number(frames) || 0) + Math.round(Number(startFrame) || 0));
  const ff = total % timebase;
  total = Math.floor(total / timebase);
  const ss = total % 60;
  total = Math.floor(total / 60);
  const mm = total % 60;
  const hh = Math.floor(total / 60);
  return [hh, mm, ss, ff].map((part) => String(part).padStart(2, '0')).join(':');
}

export function parseTimecode(value, fpsValue = '25') {
  const { timebase } = getRate(fpsValue);
  const parts = String(value || '').trim().split(':').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    throw new Error('Стартовый таймкод должен иметь вид HH:MM:SS:FF');
  }
  const [hh, mm, ss, ff] = parts;
  if (mm > 59 || ss > 59 || ff >= timebase) {
    throw new Error(`Некорректный таймкод для ${timebase} fps`);
  }
  return (((hh * 60) + mm) * 60 + ss) * timebase + ff;
}

export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('JSON-проект должен быть объектом');
  const comments = Array.isArray(raw.comments) ? raw.comments : [];
  const normalizedComments = comments.map((comment, index) => {
    const time = Number(comment.time ?? comment.startTime ?? comment.seconds ?? 0);
    const durationSeconds = Number(comment.durationSeconds ?? comment.duration ?? 0);
    return {
      id: String(comment.id || `comment-${index + 1}`),
      time: Number.isFinite(time) ? Math.max(0, time) : 0,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
      type: String(comment.type || 'Другое'),
      text: String(comment.text || comment.comment || '').trim() || 'Без текста',
      author: String(comment.author || raw.authorName || 'Без имени'),
      status: String(comment.status || 'open'),
      createdAt: comment.createdAt || null,
      screenshotDataUrl: typeof comment.screenshotDataUrl === 'string' ? comment.screenshotDataUrl : null,
      screenshotMime: comment.screenshotMime || null,
      annotations: Array.isArray(comment.annotations) ? comment.annotations : [],
      enabled: comment.enabled !== false,
    };
  }).sort((a, b) => a.time - b.time);

  return {
    version: Number(raw.version || 1),
    projectName: String(raw.projectName || raw.name || 'Проект без названия'),
    authorName: String(raw.authorName || ''),
    source: raw.source || null,
    savedAt: raw.savedAt || null,
    comments: normalizedComments,
  };
}

export function sanitizeFilename(value, fallback = 'file') {
  const clean = String(value || fallback)
    .normalize('NFKD')
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 90);
  return clean || fallback;
}

export function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function packIntoTracks(items) {
  const tracks = [];
  const sorted = [...items].sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame);
  for (const item of sorted) {
    let placed = false;
    for (const track of tracks) {
      if (track.lastEnd <= item.startFrame) {
        track.items.push(item);
        track.lastEnd = item.endFrame;
        placed = true;
        break;
      }
    }
    if (!placed) tracks.push({ items: [item], lastEnd: item.endFrame });
  }
  return tracks.map((track) => track.items);
}

function rateXml(rate, indent = '') {
  return `${indent}<rate>\n${indent}  <timebase>${rate.timebase}</timebase>\n${indent}  <ntsc>${rate.ntsc ? 'TRUE' : 'FALSE'}</ntsc>\n${indent}</rate>`;
}

function sampleCharacteristicsXml(settings, rate, indent = '') {
  return `${indent}<samplecharacteristics>\n${rateXml(rate, `${indent}  `)}\n${indent}  <width>${settings.width}</width>\n${indent}  <height>${settings.height}</height>\n${indent}  <anamorphic>FALSE</anamorphic>\n${indent}  <pixelaspectratio>square</pixelaspectratio>\n${indent}  <fielddominance>none</fielddominance>\n${indent}</samplecharacteristics>`;
}

function filePathUrl(filename) {
  const encoded = String(filename).split('/').map(encodeURIComponent).join('/');
  return `file://localhost/Pravochnaya_Premiere/${encoded}`;
}

function markerXml(item, settings, startFrameOffset) {
  const status = item.status === 'done' ? 'Выполнено' : item.status;
  const markerName = `#${item.index} · ${item.type}`;
  const markerComment = [item.text, `Автор: ${item.author}`, `Статус: ${status}`, `Кадр: ${framesToTimecode(item.startFrame, settings.fps, startFrameOffset)}`].join('\n');
  return `      <marker>\n        <name>${escapeXml(markerName)}</name>\n        <comment>${escapeXml(markerComment)}</comment>\n        <in>${item.startFrame}</in>\n        <out>${Math.max(item.startFrame + 1, item.endFrame)}</out>\n      </marker>`;
}

function clipItemXml(item, settings, rate, fileId, clipId) {
  const duration = Math.max(1, item.endFrame - item.startFrame);
  const displayName = `#${item.index} ${item.type} — ${item.text}`.slice(0, 180);
  return `            <clipitem id="${clipId}">\n              <name>${escapeXml(displayName)}</name>\n              <enabled>TRUE</enabled>\n              <duration>${duration}</duration>\n${rateXml(rate, '              ')}\n              <start>${item.startFrame}</start>\n              <end>${item.endFrame}</end>\n              <in>0</in>\n              <out>${duration}</out>\n              <stillframe>TRUE</stillframe>\n              <pixelaspectratio>square</pixelaspectratio>\n              <anamorphic>FALSE</anamorphic>\n              <file id="${fileId}">\n                <name>${escapeXml(item.filename.split('/').pop())}</name>\n                <pathurl>${escapeXml(filePathUrl(item.filename))}</pathurl>\n${rateXml(rate, '                ')}\n                <duration>${duration}</duration>\n                <timecode>\n${rateXml(rate, '                  ')}\n                  <string>00:00:00:00</string>\n                  <frame>0</frame>\n                  <displayformat>NDF</displayformat>\n                </timecode>\n                <media>\n                  <video>\n${sampleCharacteristicsXml(settings, rate, '                    ')}\n                  </video>\n                </media>\n              </file>\n              <sourcetrack>\n                <mediatype>video</mediatype>\n                <trackindex>1</trackindex>\n              </sourcetrack>\n              <labels>\n                <label2>${item.status === 'done' ? 'Forest' : 'Rose'}</label2>\n              </labels>\n            </clipitem>`;
}

export function prepareTimeline(project, settings) {
  const defaultDuration = Math.max(0.04, Number(settings.overlayDurationSeconds) || 2);
  const enabled = project.comments.filter((comment) => comment.enabled !== false);
  const items = enabled.map((comment, zeroIndex) => {
    const startFrame = secondsToFrames(comment.time, settings.fps);
    const requestedDuration = comment.durationSeconds || defaultDuration;
    const durationFrames = Math.max(1, secondsToFrames(requestedDuration, settings.fps));
    const safeTime = framesToTimecode(startFrame, settings.fps).replaceAll(':', '-');
    return {
      ...comment,
      index: zeroIndex + 1,
      startFrame,
      endFrame: startFrame + durationFrames,
      durationFrames,
      filename: `overlays/${String(zeroIndex + 1).padStart(3, '0')}_${safeTime}_${sanitizeFilename(comment.type, 'comment')}.png`,
    };
  });
  return { items, tracks: packIntoTracks(items) };
}

export function buildPremiereXml(project, settings, prepared = prepareTimeline(project, settings)) {
  const rate = getRate(settings.fps);
  const startFrameOffset = parseTimecode(settings.startTimecode || '00:00:00:00', settings.fps);
  const maxEnd = prepared.items.reduce((max, item) => Math.max(max, item.endFrame), 0);
  const requestedDurationFrames = secondsToFrames(Number(settings.sequenceDurationSeconds) || 0, settings.fps);
  const sequenceDuration = Math.max(1, maxEnd, requestedDurationFrames);
  const sequenceName = `${project.projectName} — ПРАВОЧНАЯ`;

  const trackXml = prepared.tracks.map((track) => {
    const itemsXml = track.map((item) => clipItemXml(item, settings, rate, `file-${item.index}`, `clipitem-${item.index}`)).join('\n');
    return `          <track>\n${itemsXml}\n            <enabled>TRUE</enabled>\n            <locked>FALSE</locked>\n          </track>`;
  }).join('\n');

  const markersXml = prepared.items.map((item) => markerXml(item, settings, startFrameOffset)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5">\n  <project>\n    <name>${escapeXml(sequenceName)}</name>\n    <children>\n      <sequence id="sequence-1">\n        <name>${escapeXml(sequenceName)}</name>\n        <duration>${sequenceDuration}</duration>\n${rateXml(rate, '        ')}\n        <in>-1</in>\n        <out>-1</out>\n        <timecode>\n${rateXml(rate, '          ')}\n          <string>${escapeXml(settings.startTimecode || '00:00:00:00')}</string>\n          <frame>${startFrameOffset}</frame>\n          <displayformat>NDF</displayformat>\n        </timecode>\n        <media>\n          <video>\n            <format>\n${sampleCharacteristicsXml(settings, rate, '              ')}\n            </format>\n${trackXml}\n          </video>\n          <audio>\n            <numOutputChannels>2</numOutputChannels>\n            <format>\n              <samplecharacteristics>\n                <depth>16</depth>\n                <samplerate>48000</samplerate>\n              </samplecharacteristics>\n            </format>\n          </audio>\n        </media>\n${markersXml}\n      </sequence>\n    </children>\n  </project>\n</xmeml>\n`;
}

export function buildManifestCsv(project, settings, prepared) {
  const header = ['№', 'Таймкод', 'Секунды', 'Длительность', 'Тип', 'Правка', 'Автор', 'Статус', 'PNG'];
  const rows = prepared.items.map((item) => [
    item.index,
    framesToTimecode(item.startFrame, settings.fps),
    item.time.toFixed(3),
    (item.durationFrames / getRate(settings.fps).fps).toFixed(3),
    item.type,
    item.text,
    item.author,
    item.status,
    item.filename,
  ]);
  const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n');
}

export function buildImportReadme(project, settings, prepared) {
  const trackCount = prepared.tracks.length;
  return `ПРАВОЧНАЯ → ADOBE PREMIERE PRO\n\nПроект: ${project.projectName}\nПравок: ${prepared.items.length}\nFPS: ${settings.fps}\nРазмер: ${settings.width}x${settings.height}\nСтартовый таймкод: ${settings.startTimecode}\nДорожек оверлеев: ${trackCount}\n\nКАК ИМПОРТИРОВАТЬ\n\n1. Полностью распакуйте ZIP. Не переносите XML отдельно от папки overlays.\n2. В Adobe Premiere Pro выберите Файл → Импорт и откройте файл pravochnaya-premiere.xml.\n3. Premiere создаст секвенцию «${project.projectName} — ПРАВОЧНАЯ».\n4. Если PNG отображаются Offline, выберите Link Media / Связать медиа и укажите первый файл в папке overlays. Остальные файлы обычно находятся автоматически.\n5. Самый быстрый способ: перетащите импортированную секвенцию целиком на верхнюю видеодорожку вашего монтажа, точно от старта секвенции.\n6. Для редактирования отдельных карточек откройте импортированную секвенцию, скопируйте клипы с верхних видеодорожек и вставьте их над монтажом.\n7. Sequence markers находятся в импортированной секвенции и содержат полный текст правок.\n\nВАЖНО\n\n• FPS, разрешение и стартовый таймкод должны совпадать с монтажной секвенцией.\n• Эта версия использует NDF-таймкод. Для drop-frame 29.97/59.94 потребуется отдельная настройка.\n• Если исходное видео для правок начинается позже монтажа или имеет вставленную заставку, задайте соответствующий стартовый таймкод/смещение до экспорта.\n• PNG прозрачные. Они рассчитаны на размещение поверх основного монтажа.\n`;
}

export function buildExportSettings(raw = {}) {
  const width = Math.max(320, Math.round(Number(raw.width) || 1920));
  const height = Math.max(180, Math.round(Number(raw.height) || 1080));
  const fps = String(raw.fps || '25');
  getRate(fps);
  parseTimecode(raw.startTimecode || '00:00:00:00', fps);
  return {
    width,
    height,
    fps,
    startTimecode: raw.startTimecode || '00:00:00:00',
    overlayDurationSeconds: Math.max(0.04, Number(raw.overlayDurationSeconds) || 2),
    sequenceDurationSeconds: Math.max(0, Number(raw.sequenceDurationSeconds) || 0),
    overlayStyle: raw.overlayStyle || 'card-thumbnail',
    thumbnailPosition: raw.thumbnailPosition || 'right',
  };
}
