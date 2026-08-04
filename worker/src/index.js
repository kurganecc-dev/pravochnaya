const YANDEX_PUBLIC_API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;

function getCorsOrigin(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const configured = String(env.ALLOWED_ORIGINS || '*').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*')) return '*';
  return requestOrigin && configured.includes(requestOrigin) ? requestOrigin : '';
}

function corsHeaders(request, env) {
  const origin = getCorsOrigin(request, env);
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(payload, status, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(request, env) },
  });
}

function isPublicYandexLink(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ['http:', 'https:'].includes(url.protocol) && (host === 'yadi.sk' || host.endsWith('.yadi.sk') || /(^|\.)disk\.yandex\.(ru|com|kz|by)$/.test(host));
  } catch { return false; }
}

async function fetchYandexJson(endpoint, publicKey, fields = '') {
  const url = new URL(endpoint);
  url.searchParams.set('public_key', publicKey);
  if (fields) url.searchParams.set('fields', fields);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.description || `Ошибка Яндекс Диска (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getMetadata(publicKey) {
  return fetchYandexJson(YANDEX_PUBLIC_API, publicKey, 'name,type,mime_type,media_type,size');
}

function validateVideo(meta) {
  if (meta?.type === 'dir') {
    const error = new Error('Ссылка ведёт на папку. Нужна ссылка на конкретный видеофайл');
    error.status = 400;
    throw error;
  }
  const video = meta?.media_type === 'video' || String(meta?.mime_type || '').startsWith('video/') || VIDEO_EXTENSIONS.test(meta?.name || '');
  if (!video) {
    const error = new Error('По этой ссылке найден не видеофайл');
    error.status = 400;
    throw error;
  }
}

async function handleMetadata(request, env, url) {
  const publicKey = url.searchParams.get('public_key')?.trim() || '';
  if (!isPublicYandexLink(publicKey)) return json({ message: 'Нужна публичная ссылка Яндекс Диска' }, 400, request, env);
  try {
    const meta = await getMetadata(publicKey);
    validateVideo(meta);
    return json(meta, 200, request, env);
  } catch (error) {
    return json({ message: error.message || 'Не удалось получить данные Яндекс Диска' }, Number(error.status) || 502, request, env);
  }
}

async function handleMedia(request, env, url) {
  const publicKey = url.searchParams.get('public_key')?.trim() || '';
  if (!isPublicYandexLink(publicKey)) return json({ message: 'Нужна публичная ссылка Яндекс Диска' }, 400, request, env);
  try {
    const [meta, download] = await Promise.all([getMetadata(publicKey), fetchYandexJson(`${YANDEX_PUBLIC_API}/download`, publicKey)]);
    validateVideo(meta);
    if (!download?.href) throw new Error('Яндекс Диск не вернул ссылку для воспроизведения');
    const headers = new Headers({ Accept: '*/*' });
    const range = request.headers.get('Range');
    if (range) headers.set('Range', range);
    const upstream = await fetch(download.href, { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers, redirect: 'follow' });
    const output = new Headers();
    for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(name);
      if (value) output.set(name, value);
    }
    if (!output.has('Content-Type') && meta.mime_type) output.set('Content-Type', meta.mime_type);
    output.set('Cache-Control', 'private, max-age=300');
    Object.entries(corsHeaders(request, env)).forEach(([key, value]) => output.set(key, value));
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: output });
  } catch (error) {
    return json({ message: error.message || 'Не удалось открыть видео с Яндекс Диска' }, Number(error.status) || 502, request, env);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      if (!getCorsOrigin(request, env)) return json({ message: 'Origin запрещён' }, 403, request, env);
      return new Response(null, { status: 204, headers: cors });
    }
    if (!getCorsOrigin(request, env)) return json({ message: 'Origin запрещён' }, 403, request, env);
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'video-review-yandex-proxy' }, 200, request, env);
    if (url.pathname === '/api/yandex' && request.method === 'GET') return handleMetadata(request, env, url);
    if (url.pathname === '/api/media' && ['GET', 'HEAD'].includes(request.method)) return handleMedia(request, env, url);
    return json({ message: 'Маршрут не найден' }, 404, request, env);
  },
};
