import { framesToTimecode } from './premiere.js';

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\n+/);
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось загрузить скриншот для PNG'));
    image.src = src;
  });
}

function drawContainedImage(ctx, image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawAnnotations(ctx, annotations, width, height) {
  for (const stroke of annotations || []) {
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) continue;
    ctx.save();
    ctx.strokeStyle = stroke.color || '#ff2d2d';
    ctx.fillStyle = stroke.color || '#ff2d2d';
    ctx.lineWidth = Math.max(2, Number(stroke.size || 4) * (width / 1920));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const px = Math.max(0, Math.min(1, Number(point.x) || 0)) * width;
      const py = Math.max(0, Math.min(1, Number(point.y) || 0)) * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBadge(ctx, text, x, y, fontSize, fill = '#d71920') {
  ctx.save();
  ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`;
  const padX = fontSize * 0.65;
  const height = fontSize * 1.75;
  const width = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + height / 2 + 1);
  ctx.restore();
  return width;
}

function drawCard(ctx, item, settings, cardBox) {
  const { x, y, width } = cardBox;
  const scale = settings.width / 1920;
  const pad = Math.round(30 * scale);
  const titleSize = Math.max(22, Math.round(34 * scale));
  const bodySize = Math.max(20, Math.round(31 * scale));
  const metaSize = Math.max(16, Math.round(22 * scale));
  const lineHeight = Math.round(bodySize * 1.32);

  ctx.save();
  ctx.font = `650 ${bodySize}px Inter, Arial, sans-serif`;
  const lines = wrapText(ctx, item.text, width - pad * 2).slice(0, 6);
  const headerHeight = Math.round(76 * scale);
  const bodyHeight = Math.max(lineHeight * lines.length, lineHeight);
  const footerHeight = Math.round(52 * scale);
  const height = pad + headerHeight + bodyHeight + footerHeight + pad;

  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = Math.round(34 * scale);
  ctx.shadowOffsetY = Math.round(12 * scale);
  ctx.fillStyle = 'rgba(16, 18, 22, 0.91)';
  roundRect(ctx, x, y, width, height, Math.round(28 * scale));
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#d71920';
  roundRect(ctx, x, y, Math.round(14 * scale), height, Math.round(7 * scale));
  ctx.fill();

  const contentX = x + pad + Math.round(6 * scale);
  const contentWidth = width - pad * 2;
  const badgeY = y + pad;
  const numberWidth = drawBadge(ctx, `#${item.index}`, contentX, badgeY, titleSize * 0.7);
  const typeX = contentX + numberWidth + Math.round(14 * scale);
  drawBadge(ctx, item.type.toUpperCase(), typeX, badgeY, titleSize * 0.62, 'rgba(255,255,255,.16)');

  ctx.font = `800 ${titleSize}px Inter, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(framesToTimecode(item.startFrame, settings.fps), x + width - pad, badgeY + titleSize * 0.62, contentWidth * 0.38);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `650 ${bodySize}px Inter, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  let lineY = y + pad + headerHeight;
  for (const line of lines) {
    ctx.fillText(line, contentX, lineY, contentWidth);
    lineY += lineHeight;
  }

  const footerY = y + height - pad - footerHeight + Math.round(8 * scale);
  ctx.font = `550 ${metaSize}px Inter, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.68)';
  const status = item.status === 'done' ? 'Выполнено' : 'Открыто';
  ctx.fillText(`${item.author} · ${status}`, contentX, footerY, contentWidth);
  ctx.restore();
  return { ...cardBox, height };
}

function drawThumbnail(ctx, image, settings, position = 'right') {
  if (!image) return null;
  const scale = settings.width / 1920;
  const margin = Math.round(48 * scale);
  const width = Math.round(settings.width * 0.34);
  const height = Math.round(width * 9 / 16);
  const x = position === 'left' ? margin : settings.width - width - margin;
  const y = settings.height - height - margin;
  const radius = Math.round(24 * scale);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = Math.round(34 * scale);
  ctx.shadowOffsetY = Math.round(12 * scale);
  ctx.fillStyle = '#101216';
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  drawContainedImage(ctx, image, x, y, width, height);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.92)';
  ctx.lineWidth = Math.max(2, Math.round(4 * scale));
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
  const label = 'КАДР ИЗ ПРАВОЧНОЙ';
  const labelSize = Math.max(14, Math.round(19 * scale));
  ctx.font = `800 ${labelSize}px Inter, Arial, sans-serif`;
  const labelWidth = ctx.measureText(label).width + labelSize * 1.5;
  const labelHeight = labelSize * 1.8;
  ctx.fillStyle = '#d71920';
  roundRect(ctx, x + Math.round(14 * scale), y + Math.round(14 * scale), labelWidth, labelHeight, labelHeight / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + Math.round(14 * scale) + labelSize * 0.75, y + Math.round(14 * scale) + labelHeight / 2 + 1);
  ctx.restore();
  return { x, y, width, height };
}

export async function renderOverlay(item, settings) {
  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let screenshot = null;
  if (item.screenshotDataUrl) {
    try { screenshot = await loadImage(item.screenshotDataUrl); } catch { screenshot = null; }
  }

  const scale = settings.width / 1920;
  const margin = Math.round(48 * scale);
  const style = settings.overlayStyle;

  if (style === 'full-reference' && screenshot) {
    ctx.save();
    ctx.globalAlpha = 0.76;
    drawCoverImage(ctx, screenshot, 0, 0, settings.width, settings.height);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, settings.width, settings.height);
  }

  if (item.annotations?.length) drawAnnotations(ctx, item.annotations, settings.width, settings.height);

  const hasThumb = style === 'card-thumbnail' && screenshot;
  const cardWidth = Math.round(settings.width * (hasThumb ? 0.52 : 0.58));
  const cardX = settings.thumbnailPosition === 'left' && hasThumb
    ? settings.width - cardWidth - margin
    : margin;
  drawCard(ctx, item, settings, { x: cardX, y: margin, width: cardWidth });

  if (hasThumb) drawThumbnail(ctx, screenshot, settings, settings.thumbnailPosition);

  ctx.save();
  const footerSize = Math.max(14, Math.round(18 * scale));
  ctx.font = `800 ${footerSize}px Inter, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = Math.round(8 * scale);
  ctx.fillText('ПРАВОЧНАЯ · PREMIERE OVERLAY', settings.width / 2, settings.height - Math.round(22 * scale));
  ctx.restore();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Не удалось создать PNG')), 'image/png');
  });
  return { blob, canvas };
}
