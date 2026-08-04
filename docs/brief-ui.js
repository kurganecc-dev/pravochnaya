import {
  BRIEF_FIELDS,
  BRIEF_SECTIONS,
  buildBriefText,
  countCompletedBriefFields,
  emptyBriefData,
  getBriefAnswer,
  getBriefReadiness,
  getBriefSectionProgress,
  getVisibleBriefFields,
  isBriefFieldVisible,
  normalizeBriefData,
  sanitizeBriefFilename,
} from './lib/brief.js';

const STORAGE_KEY = 'pravochnaya-production-brief-v2';
const LEGACY_STORAGE_KEY = 'pravochnaya-production-brief-v1';
const VIEW_STORAGE_KEY = 'pravochnaya-production-last-service-v1';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  serviceLauncher: $('#serviceLauncher'),
  serviceHomeBtn: $('#serviceHomeBtn'),
  launchButtons: $$('[data-launch-view]'),
  reviewView: $('#reviewView'),
  briefView: $('#briefView'),
  reviewTopActions: $('#reviewTopActions'),
  brandTitle: $('#brandTitle'),
  brandSubtitle: $('#brandSubtitle'),
  navButtons: $$('[data-app-view]'),
  briefForm: $('#briefForm'),
  briefStepper: $('#briefStepper'),
  briefFields: $('#briefFields'),
  briefStepEyebrow: $('#briefStepEyebrow'),
  briefStepTitle: $('#briefStepTitle'),
  briefStepDescription: $('#briefStepDescription'),
  briefStepCounter: $('#briefStepCounter'),
  briefPrevBtn: $('#briefPrevBtn'),
  briefNextBtn: $('#briefNextBtn'),
  briefOutput: $('#briefOutput'),
  briefProgressValue: $('#briefProgressValue'),
  briefProgressBar: $('#briefProgressBar'),
  briefProgressMeta: $('#briefProgressMeta'),
  briefSaveStatus: $('#briefSaveStatus'),
  briefReadinessCard: $('#briefReadinessCard'),
  briefReadinessIcon: $('#briefReadinessIcon'),
  briefReadinessTitle: $('#briefReadinessTitle'),
  briefReadinessText: $('#briefReadinessText'),
  briefMissingWrap: $('#briefMissingWrap'),
  briefMissingList: $('#briefMissingList'),
  copyBriefBtn: $('#copyBriefBtn'),
  downloadBriefBtn: $('#downloadBriefBtn'),
  clearBriefBtn: $('#clearBriefBtn'),
};

let state = loadState();
let saveTimer = null;
let activeSectionIndex = findFirstIncompleteSectionIndex();

function showToast(message) {
  if (window.PRAVOCHNAYA_API?.showToast) {
    window.PRAVOCHNAYA_API.showToast(message);
    return;
  }
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeBriefData(JSON.parse(current));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return normalizeBriefData(JSON.parse(legacy));
  } catch {
    // Ignore damaged or unavailable browser storage.
  }
  return emptyBriefData();
}

function persistState() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    els.briefSaveStatus.textContent = 'Сохранено в браузере';
  } catch {
    els.briefSaveStatus.textContent = 'Не удалось сохранить';
  }
}

function scheduleSave() {
  els.briefSaveStatus.textContent = 'Сохраняем…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistState, 350);
}

function fieldIndex(field) {
  return BRIEF_FIELDS.findIndex((item) => item.id === field.id);
}

function shouldShowDetail(field) {
  if (!field.detailPlaceholder) return false;
  if (!field.detailWhen?.length) return true;
  const answer = state.answers[field.id];
  if (Array.isArray(answer)) return answer.some((value) => field.detailWhen.includes(value));
  return field.detailWhen.includes(answer);
}

function setAnswer(field, value, { rerender = false } = {}) {
  state.answers[field.id] = value;
  if (!shouldShowDetail(field)) state.details[field.id] = '';
  if (rerender) renderCurrentSection();
  updateBriefState();
}

function createTextControl(field) {
  const element = field.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (field.type !== 'textarea') element.type = 'text';
  element.id = `brief-${field.id}`;
  element.name = field.id;
  element.placeholder = field.placeholder || '';
  if (field.rows) element.rows = field.rows;
  element.value = state.answers[field.id] || '';
  element.addEventListener('input', () => setAnswer(field, element.value));
  return element;
}

function createOptionLabel(field, value, kind) {
  const label = document.createElement('label');
  label.className = 'brief-choice';

  const input = document.createElement('input');
  input.type = kind;
  input.name = field.id;
  input.value = value;
  input.checked = kind === 'checkbox'
    ? state.answers[field.id]?.includes(value)
    : state.answers[field.id] === value;

  const span = document.createElement('span');
  span.textContent = value;
  label.append(input, span);

  input.addEventListener('change', () => {
    if (kind === 'checkbox') {
      const selected = [...document.querySelectorAll(`input[name="${field.id}"]:checked`)].map((node) => node.value);
      setAnswer(field, selected, { rerender: true });
    } else {
      setAnswer(field, input.checked ? input.value : '', { rerender: true });
    }
  });
  return label;
}

function createChoices(field, kind) {
  const wrapper = document.createElement('div');
  wrapper.className = 'brief-choice-control';
  wrapper.id = `brief-${field.id}`;

  const choices = document.createElement('div');
  choices.className = 'brief-choices';
  field.options.forEach((option) => choices.append(createOptionLabel(field, option, kind)));
  wrapper.append(choices);

  if (field.other) {
    const other = document.createElement('input');
    other.type = 'text';
    other.className = 'brief-other-input';
    other.placeholder = 'Другой вариант';
    other.value = state.others[field.id] || '';
    other.addEventListener('input', () => {
      state.others[field.id] = other.value;
      updateBriefState();
    });
    wrapper.append(other);
  }

  if (shouldShowDetail(field)) {
    const detail = document.createElement('textarea');
    detail.className = 'brief-detail-input';
    detail.rows = 3;
    detail.placeholder = field.detailPlaceholder;
    detail.value = state.details[field.id] || '';
    if (field.detailRequiredWhen?.length) detail.setAttribute('aria-required', 'true');
    detail.addEventListener('input', () => {
      state.details[field.id] = detail.value;
      updateBriefState();
    });
    wrapper.append(detail);
  }

  return wrapper;
}

function createControl(field) {
  if (field.type === 'text' || field.type === 'textarea') return createTextControl(field);
  if (field.type === 'checks') return createChoices(field, 'checkbox');
  if (field.type === 'radio') return createChoices(field, 'radio');
  throw new Error(`Неизвестный тип поля: ${field.type}`);
}

function fieldHasAnswer(field) {
  return Boolean(getBriefAnswer(state, field));
}

function renderQuestion(field) {
  const section = document.createElement('section');
  const isWide = field.wide || (field.type === 'textarea' && Number(field.rows || 0) >= 4);
  section.className = `brief-question${isWide ? ' wide' : ''}${fieldHasAnswer(field) ? ' complete' : ''}`;
  section.dataset.briefQuestion = field.id;
  section.id = `brief-field-${field.id}`;

  const heading = document.createElement('div');
  heading.className = 'brief-question-heading';

  const number = document.createElement('span');
  number.className = 'brief-question-number';
  number.textContent = String(fieldIndex(field) + 1).padStart(2, '0');

  const titleWrap = document.createElement('div');
  const title = document.createElement('label');
  title.className = 'brief-question-title';
  title.textContent = field.title;
  if (field.type === 'text' || field.type === 'textarea') title.htmlFor = `brief-${field.id}`;
  titleWrap.append(title);

  const status = document.createElement('span');
  status.className = field.required ? 'brief-required' : 'brief-optional';
  status.textContent = field.required ? 'обязательно' : 'необязательно';
  titleWrap.append(status);

  if (field.help) {
    const help = document.createElement('p');
    help.className = 'brief-question-help';
    help.textContent = field.help;
    titleWrap.append(help);
  }

  heading.append(number, titleWrap);
  section.append(heading, createControl(field));
  return section;
}

function currentSection() {
  return BRIEF_SECTIONS[activeSectionIndex] || BRIEF_SECTIONS[0];
}

function renderCurrentSection() {
  const section = currentSection();
  const visibleFields = getVisibleBriefFields(state).filter((field) => field.section === section.id);
  els.briefStepEyebrow.textContent = `Этап ${activeSectionIndex + 1} из ${BRIEF_SECTIONS.length}`;
  els.briefStepTitle.textContent = section.title;
  els.briefStepDescription.textContent = section.description;
  els.briefStepCounter.textContent = `${activeSectionIndex + 1} / ${BRIEF_SECTIONS.length}`;
  els.briefFields.innerHTML = '';
  visibleFields.forEach((field) => els.briefFields.append(renderQuestion(field)));

  els.briefPrevBtn.disabled = activeSectionIndex === 0;
  els.briefNextBtn.textContent = activeSectionIndex === BRIEF_SECTIONS.length - 1
    ? 'Проверить бриф →'
    : 'Следующий этап →';
}

function renderStepper() {
  els.briefStepper.innerHTML = '';
  BRIEF_SECTIONS.forEach((section, index) => {
    const progress = getBriefSectionProgress(state, section.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `brief-step${index === activeSectionIndex ? ' active' : ''}${progress.complete ? ' complete' : ''}`;
    button.setAttribute('aria-current', index === activeSectionIndex ? 'step' : 'false');

    const number = document.createElement('span');
    number.className = 'brief-step-number';
    number.textContent = progress.complete ? '✓' : section.number;

    const copy = document.createElement('span');
    copy.className = 'brief-step-copy';
    const title = document.createElement('strong');
    title.textContent = section.shortTitle;
    const meta = document.createElement('span');
    meta.textContent = progress.required
      ? `${progress.completedRequired}/${progress.required} обязательных`
      : `${progress.answered}/${progress.fields} заполнено`;
    copy.append(title, meta);

    button.append(number, copy);
    button.addEventListener('click', () => goToSection(index));
    els.briefStepper.append(button);
  });
}

function renderReadiness() {
  const readiness = getBriefReadiness(state);
  els.briefProgressValue.textContent = `${readiness.percent}%`;
  els.briefProgressBar.style.width = `${readiness.percent}%`;
  els.briefProgressMeta.textContent = `${readiness.completed} из ${readiness.total} обязательных пунктов`;

  els.briefReadinessCard.classList.toggle('ready', readiness.ready);
  els.briefReadinessIcon.textContent = readiness.ready ? '✓' : '!';
  els.briefReadinessTitle.textContent = readiness.ready
    ? 'Бриф готов к предварительной оценке'
    : `Нужно уточнить ещё ${readiness.missing.length} пункт(а)`;
  els.briefReadinessText.textContent = readiness.ready
    ? 'Продакшен сможет оценить состав работ, сроки и следующий шаг.'
    : 'Нажмите на пункт ниже, чтобы перейти к нужному вопросу.';

  els.briefMissingWrap.classList.toggle('hidden', readiness.ready);
  els.briefMissingList.innerHTML = '';
  readiness.missing.slice(0, 10).forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'brief-missing-item';
    button.textContent = item.title;
    button.addEventListener('click', () => {
      const index = BRIEF_SECTIONS.findIndex((section) => section.id === item.section);
      goToSection(index, item.fieldId);
    });
    els.briefMissingList.append(button);
  });
  if (readiness.missing.length > 10) {
    const more = document.createElement('span');
    more.className = 'brief-missing-more';
    more.textContent = `И ещё ${readiness.missing.length - 10}`;
    els.briefMissingList.append(more);
  }
}

function refreshQuestionClasses() {
  $$('[data-brief-question]').forEach((node) => {
    const field = BRIEF_FIELDS.find((item) => item.id === node.dataset.briefQuestion);
    node.classList.toggle('complete', field ? fieldHasAnswer(field) : false);
  });
}

function updateBriefState({ save = true } = {}) {
  els.briefOutput.value = buildBriefText(state);
  renderReadiness();
  renderStepper();
  refreshQuestionClasses();
  if (save) scheduleSave();
}

function findFirstIncompleteSectionIndex() {
  const readiness = getBriefReadiness(state);
  if (!readiness.missing.length) return 0;
  const index = BRIEF_SECTIONS.findIndex((section) => section.id === readiness.missing[0].section);
  return index >= 0 ? index : 0;
}

function goToSection(index, focusFieldId = '') {
  activeSectionIndex = Math.min(Math.max(0, index), BRIEF_SECTIONS.length - 1);
  renderCurrentSection();
  renderStepper();
  const stage = $('.brief-stage');
  stage?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (focusFieldId) {
    setTimeout(() => {
      const node = $(`#brief-field-${focusFieldId}`);
      const focusable = node?.querySelector('input, textarea, select, button');
      focusable?.focus({ preventScroll: true });
    }, 350);
  }
}

async function copyBrief() {
  const text = buildBriefText(state);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Бриф скопирован');
  } catch {
    els.briefOutput.focus();
    els.briefOutput.select();
    const copied = document.execCommand?.('copy');
    showToast(copied ? 'Бриф скопирован' : 'Выделите текст и скопируйте вручную');
  }
}

function downloadBrief() {
  const blob = new Blob([buildBriefText(state)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeBriefFilename(state);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Текстовый файл подготовлен');
}

function clearBrief() {
  if (!confirm('Очистить все ответы брифа?')) return;
  state = emptyBriefData();
  activeSectionIndex = 0;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  renderCurrentSection();
  updateBriefState();
  showToast('Бриф очищен');
}

function rememberView(view) {
  try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* Storage can be disabled. */ }
}

function readRememberedView() {
  try {
    const value = localStorage.getItem(VIEW_STORAGE_KEY);
    return value === 'brief' || value === 'review' ? value : '';
  } catch {
    return '';
  }
}

function showLauncher(updateHash = true) {
  document.body.classList.remove('app-initializing');
  document.body.classList.add('launcher-open');
  els.serviceLauncher.classList.remove('hidden');
  els.reviewView.classList.add('hidden');
  els.briefView.classList.add('hidden');
  els.reviewTopActions.classList.add('hidden');
  els.navButtons.forEach((button) => {
    button.classList.remove('active');
    button.setAttribute('aria-selected', 'false');
  });
  els.brandTitle.textContent = 'Видео · Продакшн';
  els.brandSubtitle.textContent = 'выберите нужный сервис';
  document.title = 'Сервисы видеопродакшена';
  if (updateHash) history.replaceState(null, '', '#services');
}

function activateView(view, updateHash = true, remember = true) {
  const isBrief = view === 'brief';
  document.body.classList.remove('app-initializing', 'launcher-open');
  els.serviceLauncher.classList.add('hidden');
  els.reviewView.classList.toggle('hidden', isBrief);
  els.briefView.classList.toggle('hidden', !isBrief);
  els.reviewTopActions.classList.toggle('hidden', isBrief);
  els.navButtons.forEach((button) => {
    const active = button.dataset.appView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.brandTitle.textContent = isBrief ? 'Видео · Бриф' : 'Видео · Правки';
  els.brandSubtitle.textContent = isBrief ? 'точная заявка на видеопроизводство' : 'внутренний сервис продакшена';
  document.title = isBrief ? 'Бриф на видео — Продакшн' : 'Правки по видео — Продакшн';
  if (updateHash) history.replaceState(null, '', isBrief ? '#brief' : '#review');
  if (remember) rememberView(view);
  if (isBrief) updateBriefState({ save: false });
}

function applyRouteFromLocation() {
  if (location.hash === '#brief') {
    activateView('brief', false);
    return;
  }
  if (location.hash === '#review') {
    activateView('review', false);
    return;
  }
  if (location.hash === '#services') {
    showLauncher(false);
    return;
  }
  const remembered = readRememberedView();
  if (remembered) activateView(remembered, false, false);
  else showLauncher(false);
}

renderCurrentSection();
updateBriefState({ save: false });

els.briefPrevBtn.addEventListener('click', () => goToSection(activeSectionIndex - 1));
els.briefNextBtn.addEventListener('click', () => {
  if (activeSectionIndex < BRIEF_SECTIONS.length - 1) {
    goToSection(activeSectionIndex + 1);
  } else {
    renderReadiness();
    els.briefReadinessCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
els.copyBriefBtn.addEventListener('click', copyBrief);
els.downloadBriefBtn.addEventListener('click', downloadBrief);
els.clearBriefBtn.addEventListener('click', clearBrief);
els.navButtons.forEach((button) => button.addEventListener('click', () => activateView(button.dataset.appView)));
els.launchButtons.forEach((button) => button.addEventListener('click', () => activateView(button.dataset.launchView)));
els.serviceHomeBtn.addEventListener('click', () => showLauncher());
window.addEventListener('hashchange', applyRouteFromLocation);
applyRouteFromLocation();

window.PRAVOCHNAYA_BRIEF_API = Object.freeze({
  getSnapshot: () => JSON.parse(JSON.stringify(state)),
  getText: () => buildBriefText(state),
  getReadiness: () => getBriefReadiness(state),
  open: () => activateView('brief'),
  openServices: () => showLauncher(),
});
