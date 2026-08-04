import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRIEF_FIELDS,
  BRIEF_SECTIONS,
  buildBriefText,
  emptyBriefData,
  getBriefReadiness,
  getVisibleBriefFields,
  isBriefFieldVisible,
  normalizeBriefData,
  sanitizeBriefFilename,
} from '../docs/lib/brief.js';

function answerRequiredFields(data) {
  let guard = 0;
  while (guard++ < 10) {
    const readiness = getBriefReadiness(data);
    if (readiness.ready) return data;
    readiness.missing.forEach((item) => {
      const field = BRIEF_FIELDS.find((entry) => entry.id === item.fieldId);
      if (!field) return;
      if (item.id.endsWith('__detail')) {
        data.details[field.id] = 'Подробности для производства';
        return;
      }
      if (field.type === 'checks') data.answers[field.id] = [field.options[0]];
      else if (field.type === 'radio') {
        const preferred = {
          scriptStatus: 'Сценарий не требуется',
          graphics: 'Нет',
          voiceover: 'Нет',
          subtitles: 'Субтитры не нужны',
          productionMode: 'Монтаж из готовых материалов',
        }[field.id];
        data.answers[field.id] = preferred || field.options[0];
      } else data.answers[field.id] = `Ответ: ${field.title}`;
    });
  }
  throw new Error('Could not complete required brief fields');
}

test('brief is split into six production stages with dynamic questions', () => {
  assert.equal(BRIEF_SECTIONS.length, 6);
  assert.ok(BRIEF_FIELDS.length > 40);
  assert.deepEqual(BRIEF_SECTIONS.map((section) => section.id), [
    'contacts', 'task', 'content', 'shooting', 'deliverables', 'resources',
  ]);
  assert.ok(BRIEF_FIELDS.some((field) => field.id === 'mainMessage' && field.required));
  assert.ok(BRIEF_FIELDS.some((field) => field.id === 'viewerAction' && field.required));
  assert.ok(BRIEF_FIELDS.some((field) => field.id === 'antiReferences'));
  assert.ok(BRIEF_FIELDS.some((field) => field.id === 'technicalRequirements'));
  assert.equal(BRIEF_FIELDS.some((field) => field.id === 'resolution'), false);
});

test('brief text produces a grouped production-ready message', () => {
  const data = emptyBriefData();
  data.answers.projectTitle = 'Ролик ЖК Северный';
  data.answers.contact = '@producer';
  data.answers.videoTypes = ['Имиджевый', 'Корпоративный'];
  data.answers.objective = 'Повысить узнаваемость';
  data.answers.platforms = ['Telegram', 'VK'];
  data.answers.formats = ['Горизонтальный 16:9', 'Вертикальный 9:16'];
  data.answers.finalDeadline = '20 августа';
  data.answers.budget = '70 000–150 000 ₽';
  const text = buildBriefText(data, { date: new Date('2026-08-04T00:00:00Z') });
  assert.match(text, /КРАТКАЯ СВОДКА/);
  assert.match(text, /Проект: Ролик ЖК Северный/);
  assert.match(text, /Тип ролика: Имиджевый, Корпоративный/);
  assert.match(text, /Площадки: Telegram, VK/);
  assert.match(text, /01\. ПРОЕКТ И СОГЛАСОВАНИЕ/);
  assert.match(text, /06\. БЮДЖЕТ И МАТЕРИАЛЫ/);
  assert.match(text, /НЕ ХВАТАЕТ ДЛЯ ОЦЕНКИ/);
});

test('readiness reacts to conditional shooting requirements', () => {
  const data = answerRequiredFields(emptyBriefData());
  assert.equal(getBriefReadiness(data).ready, true);
  data.answers.productionMode = 'Новая съёмка';
  const readiness = getBriefReadiness(data);
  assert.equal(readiness.ready, false);
  const missingIds = readiness.missing.map((item) => item.fieldId);
  assert.ok(missingIds.includes('location'));
  assert.ok(missingIds.includes('shootDate'));
  assert.ok(missingIds.includes('participants'));
  assert.equal(isBriefFieldVisible(BRIEF_FIELDS.find((field) => field.id === 'location'), data), true);
});

test('graphics, voiceover and subtitles request details only when needed', () => {
  const data = emptyBriefData();
  data.answers.graphics = 'Анимационная инфографика';
  let readiness = getBriefReadiness(data);
  assert.ok(readiness.missing.some((item) => item.id === 'graphics__detail'));
  data.details.graphics = 'Показать динамику продаж по кварталам';
  readiness = getBriefReadiness(data);
  assert.equal(readiness.missing.some((item) => item.id === 'graphics__detail'), false);
  data.answers.graphics = 'Нет';
  assert.equal(getBriefReadiness(data).missing.some((item) => item.id === 'graphics__detail'), false);
});

test('old 16-question draft is migrated into the expanded brief', () => {
  const data = normalizeBriefData({
    projectTitle: 'Старый проект',
    answers: {
      q01: '@name',
      q03: ['Имиджевый'],
      q05: ['Динамичная'],
      q09: 'Офис',
      q15: 'Черновой сценарий',
      q16: ['1080p — 1920×1080'],
    },
    details: { q10: 'Титры с цифрами' },
    others: { q03: 'Постановочный' },
  });
  assert.equal(data.answers.projectTitle, 'Старый проект');
  assert.equal(data.answers.contact, '@name');
  assert.deepEqual(data.answers.videoTypes, ['Имиджевый']);
  assert.equal(data.others.videoTypes, 'Постановочный');
  assert.equal(data.answers.scriptStatus, 'Есть черновик сценария');
  assert.equal(data.answers.scriptMaterials, 'Черновой сценарий');
  assert.equal(data.answers.technicalRequirements, '1080p — 1920×1080');
});

test('visible field collection hides location for edit-only projects', () => {
  const data = emptyBriefData();
  data.answers.productionMode = 'Монтаж из готовых материалов';
  const ids = getVisibleBriefFields(data).map((field) => field.id);
  assert.equal(ids.includes('location'), false);
  assert.equal(ids.includes('onsiteContact'), false);
});

test('brief filename is safe', () => {
  const data = emptyBriefData();
  data.answers.projectTitle = 'Ролик: ЖК / Северный';
  assert.equal(sanitizeBriefFilename(data), 'Ролик-ЖК-Северный.txt');
});
