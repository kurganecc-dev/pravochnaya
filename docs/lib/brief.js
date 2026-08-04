export const BRIEF_FIELDS = Object.freeze([
  {
    id: 'q01',
    number: '01',
    title: 'Ваши контакты (Telegram)',
    type: 'text',
    placeholder: '@username, имя и номер телефона',
    help: 'Укажите контакт, по которому команда сможет быстро связаться с вами.',
  },
  {
    id: 'q02',
    number: '02',
    title: 'Лицо, принимающее решение о согласовании',
    type: 'text',
    placeholder: 'Имя, должность или несколько согласующих',
  },
  {
    id: 'q03',
    number: '03',
    title: 'Тип ролика',
    type: 'checks',
    help: 'Можно выбрать несколько вариантов.',
    options: [
      'Рекламный',
      'Имиджевый',
      'Корпоративный',
      'Обучающий',
      'Презентационный',
      'Эксплейнер',
      'Интервью',
      'Репортаж',
      'Автовебинар',
    ],
    other: true,
  },
  {
    id: 'q04',
    number: '04',
    title: 'Какого эффекта нужно достичь',
    type: 'textarea',
    wide: true,
    rows: 5,
    placeholder: 'Что зритель должен понять, почувствовать или сделать после просмотра?',
    help: 'Опишите цель, ожидаемый результат и целевое действие.',
  },
  {
    id: 'q05',
    number: '05',
    title: 'Тон, стилистика видео',
    type: 'checks',
    help: 'Можно выбрать несколько характеристик.',
    options: [
      'Официальная',
      'Неформальная',
      'Динамичная',
      'Экспертная',
      'Эмоциональная',
      'Юмористическая',
      'Премиальная',
    ],
    other: true,
  },
  {
    id: 'q06',
    number: '06',
    title: 'Целевая аудитория',
    type: 'textarea',
    wide: true,
    rows: 4,
    placeholder: 'Кто будет смотреть видео, где и в какой ситуации?',
    help: 'Полезно указать должность, опыт, потребность аудитории и площадку размещения.',
  },
  {
    id: 'q07',
    number: '07',
    title: 'Хронометраж',
    type: 'text',
    placeholder: 'Например: до 1:30 или 4 ролика по 2–3 минуты',
  },
  {
    id: 'q08',
    number: '08',
    title: 'Референсы (ссылки)',
    type: 'textarea',
    rows: 4,
    placeholder: 'Одна ссылка на строку. Можно добавить комментарий, что именно нравится.',
  },
  {
    id: 'q09',
    number: '09',
    title: 'Место проведения съёмок',
    type: 'textarea',
    rows: 3,
    placeholder: 'Офис, студия, улица, объект, несколько локаций…',
  },
  {
    id: 'q10',
    number: '10',
    title: 'Нужна ли инфографика?',
    type: 'select-detail',
    options: [
      'Нет',
      'Да, базовые титры и подписи',
      'Да, анимационная инфографика',
      'Нужна консультация',
    ],
    detailPlaceholder: 'Опишите титры, графики, таблицы, цифры, иконки или анимацию',
  },
  {
    id: 'q11',
    number: '11',
    title: 'Нужна ли озвучка?',
    type: 'radio',
    options: [
      'Нет',
      'Да, своими силами',
      'Да, нужен профессиональный диктор',
      'Нужна консультация',
    ],
  },
  {
    id: 'q12',
    number: '12',
    title: 'Формат по ориентации',
    type: 'checks',
    help: 'Можно выбрать несколько форматов.',
    options: [
      'Горизонтальный 16:9',
      'Вертикальный 9:16',
      'Квадратный 1:1',
      'Несколько адаптаций',
      'Нужна рекомендация',
    ],
  },
  {
    id: 'q13',
    number: '13',
    title: 'Желаемые сроки',
    type: 'text',
    placeholder: 'Дата готовности или период публикации',
    help: 'Укажите крайний срок и, при необходимости, дату съёмки или релиза.',
  },
  {
    id: 'q14',
    number: '14',
    title: 'Бюджет',
    type: 'select-detail',
    options: [
      'Бесплатно / внутренними силами',
      'Есть утверждённый бюджет',
      'Нужна оценка стоимости',
      'Бюджет пока не определён',
    ],
    detailPlaceholder: 'Сумма, подразделение / ЦФО или важные ограничения',
  },
  {
    id: 'q15',
    number: '15',
    title: 'Сценарий',
    type: 'textarea',
    wide: true,
    rows: 7,
    placeholder: 'Опишите ход ролика, ключевые сцены, спикеров и обязательные тезисы. Можно приложить ссылку на документ.',
  },
  {
    id: 'q16',
    number: '16',
    title: 'Разрешение файла',
    type: 'checks',
    optional: true,
    help: 'Можно выбрать несколько вариантов. Оставьте пустым, если нужна рекомендация продакшена.',
    options: [
      '4K — 3840×2160',
      '1080p — 1920×1080',
      '720p — 1280×720',
      'Нужна рекомендация',
    ],
  },
]);

function cleanText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function emptyBriefData() {
  return {
    projectTitle: '',
    answers: Object.fromEntries(BRIEF_FIELDS.map((field) => [field.id, field.type === 'checks' ? [] : ''])),
    details: {},
    others: {},
    updatedAt: null,
  };
}

export function normalizeBriefData(raw) {
  const base = emptyBriefData();
  if (!raw || typeof raw !== 'object') return base;

  base.projectTitle = cleanText(raw.projectTitle);
  BRIEF_FIELDS.forEach((field) => {
    const value = raw.answers?.[field.id];
    if (field.type === 'checks') {
      base.answers[field.id] = Array.isArray(value)
        ? value.map(cleanText).filter(Boolean)
        : [];
    } else {
      base.answers[field.id] = cleanText(value);
    }
    if (raw.details && Object.hasOwn(raw.details, field.id)) {
      base.details[field.id] = cleanText(raw.details[field.id]);
    }
    if (raw.others && Object.hasOwn(raw.others, field.id)) {
      base.others[field.id] = cleanText(raw.others[field.id]);
    }
  });
  base.updatedAt = raw.updatedAt || null;
  return base;
}

export function getBriefAnswer(data, field) {
  const normalized = normalizeBriefData(data);
  const raw = normalized.answers[field.id];
  const detail = cleanText(normalized.details[field.id]);
  const other = cleanText(normalized.others[field.id]);

  if (field.type === 'checks') {
    const values = Array.isArray(raw) ? [...raw] : [];
    if (other) values.push(other);
    return values.join(', ');
  }

  if (field.type === 'select-detail') {
    if (raw && detail) return `${raw}. ${detail}`;
    return raw || detail;
  }

  return cleanText(raw);
}

export function countCompletedBriefFields(data) {
  return BRIEF_FIELDS.reduce((count, field) => count + (getBriefAnswer(data, field) ? 1 : 0), 0);
}

export function buildBriefText(data, options = {}) {
  const normalized = normalizeBriefData(data);
  const date = options.date instanceof Date ? options.date : new Date();
  const lines = ['БРИФ НА ВИДЕОПРОИЗВОДСТВО'];

  if (normalized.projectTitle) {
    lines.push('', `Проект / задача: ${normalized.projectTitle}`);
  }

  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  lines.push(`Дата заполнения: ${dateLabel}`, '');

  BRIEF_FIELDS.forEach((field) => {
    const answer = getBriefAnswer(normalized, field) || '—';
    lines.push(`${field.number}. ${field.title}`, answer, '');
  });

  return lines.join('\n').trimEnd();
}

export function sanitizeBriefFilename(value) {
  const cleaned = cleanText(value || 'brief-video')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${cleaned || 'brief-video'}.txt`;
}
