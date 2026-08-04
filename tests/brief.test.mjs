import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRIEF_FIELDS,
  buildBriefText,
  countCompletedBriefFields,
  emptyBriefData,
  normalizeBriefData,
  sanitizeBriefFilename,
} from '../docs/lib/brief.js';

test('brief contains the 16 requested questions in the correct order', () => {
  assert.equal(BRIEF_FIELDS.length, 16);
  assert.deepEqual(BRIEF_FIELDS.map((field) => field.number), [
    '01', '02', '03', '04', '05', '06', '07', '08',
    '09', '10', '11', '12', '13', '14', '15', '16',
  ]);
  assert.equal(BRIEF_FIELDS.at(-1).optional, true);
});

test('brief text joins multi-choice and detail answers', () => {
  const data = emptyBriefData();
  data.projectTitle = 'Новый ролик';
  data.answers.q01 = '@producer';
  data.answers.q03 = ['Имиджевый', 'Корпоративный'];
  data.others.q03 = 'Постановочный';
  data.answers.q10 = 'Да, анимационная инфографика';
  data.details.q10 = 'Показать график роста';
  const text = buildBriefText(data, { date: new Date('2026-08-04T00:00:00Z') });
  assert.match(text, /Проект \/ задача: Новый ролик/);
  assert.match(text, /Имиджевый, Корпоративный, Постановочный/);
  assert.match(text, /Да, анимационная инфографика\. Показать график роста/);
  assert.match(text, /16\. Разрешение файла\n—/);
});

test('brief progress counts answers, including custom and detail values', () => {
  const data = normalizeBriefData({
    answers: { q01: '@name', q03: [], q10: '' },
    others: { q03: 'Видеоподкаст' },
    details: { q10: 'Нужны только титры' },
  });
  assert.equal(countCompletedBriefFields(data), 3);
});

test('brief filename is safe', () => {
  assert.equal(sanitizeBriefFilename('Ролик: ЖК / Северный'), 'Ролик-ЖК-Северный.txt');
});
