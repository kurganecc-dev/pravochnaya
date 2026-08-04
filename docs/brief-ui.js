import {
  BRIEF_FIELDS,
  buildBriefText,
  countCompletedBriefFields,
  emptyBriefData,
  normalizeBriefData,
  sanitizeBriefFilename,
} from './lib/brief.js';

const STORAGE_KEY = 'pravochnaya-production-brief-v1';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  reviewView: $('#reviewView'),
  briefView: $('#briefView'),
  reviewTopActions: $('#reviewTopActions'),
  brandTitle: $('#brandTitle'),
  brandSubtitle: $('#brandSubtitle'),
  navButtons: $$('[data-app-view]'),
  briefForm: $('#briefForm'),
  briefFields: $('#briefFields'),
  briefProjectTitle: $('#briefProjectTitle'),
  briefOutput: $('#briefOutput'),
  briefProgressValue: $('#briefProgressValue'),
  briefProgressBar: $('#briefProgressBar'),
  briefSaveStatus: $('#briefSaveStatus'),
  copyBriefBtn: $('#copyBriefBtn'),
  downloadBriefBtn: $('#downloadBriefBtn'),
  clearBriefBtn: $('#clearBriefBtn'),
};

let state = loadState();
let saveTimer = null;

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
    return normalizeBriefData(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return emptyBriefData();
  }
}

function persistState() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function createTextControl(field) {
  const element = field.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (field.type !== 'textarea') element.type = 'text';
  element.id = `brief-${field.id}`;
  element.name = field.id;
  element.placeholder = field.placeholder || '';
  if (field.rows) element.rows = field.rows;
  element.value = state.answers[field.id] || '';
  element.addEventListener('input', () => {
    state.answers[field.id] = element.value;
    updateOutputClean();
  });
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
      state.answers[field.id] = [...document.querySelectorAll(`input[name="${field.id}"]:checked`)].map((node) => node.value);
    } else {
      state.answers[field.id] = input.checked ? input.value : '';
    }
    updateOutputClean();
  });
  return label;
}

function createChoices(field, kind) {
  const wrapper = document.createElement('div');
  wrapper.className = 'brief-choices';
  field.options.forEach((option) => wrapper.append(createOptionLabel(field, option, kind)));

  if (field.other) {
    const other = document.createElement('input');
    other.type = 'text';
    other.className = 'brief-other-input';
    other.placeholder = 'Другой вариант';
    other.value = state.others[field.id] || '';
    other.addEventListener('input', () => {
      state.others[field.id] = other.value;
      updateOutputClean();
    });
    wrapper.append(other);
  }
  return wrapper;
}

function createSelectDetail(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'brief-composite';
  const select = document.createElement('select');
  select.id = `brief-${field.id}`;
  select.name = field.id;
  select.innerHTML = '<option value="">Выберите вариант</option>';
  field.options.forEach((option) => {
    const item = document.createElement('option');
    item.value = option;
    item.textContent = option;
    item.selected = state.answers[field.id] === option;
    select.append(item);
  });
  const details = document.createElement('textarea');
  details.rows = 3;
  details.placeholder = field.detailPlaceholder || 'Дополнительная информация';
  details.value = state.details[field.id] || '';
  select.addEventListener('change', () => {
    state.answers[field.id] = select.value;
    updateOutputClean();
  });
  details.addEventListener('input', () => {
    state.details[field.id] = details.value;
    updateOutputClean();
  });
  wrapper.append(select, details);
  return wrapper;
}

function renderFields() {
  els.briefFields.innerHTML = '';
  BRIEF_FIELDS.forEach((field) => {
    const section = document.createElement('section');
    section.className = `brief-question${field.wide ? ' wide' : ''}`;
    section.dataset.briefQuestion = field.id;

    const heading = document.createElement('div');
    heading.className = 'brief-question-heading';
    const number = document.createElement('span');
    number.className = 'brief-question-number';
    number.textContent = field.number;
    const titleWrap = document.createElement('div');
    const title = document.createElement('label');
    title.className = 'brief-question-title';
    title.textContent = field.title;
    if (field.type === 'text' || field.type === 'textarea' || field.type === 'select-detail') {
      title.htmlFor = `brief-${field.id}`;
    }
    titleWrap.append(title);
    if (field.optional) {
      const optional = document.createElement('span');
      optional.className = 'brief-optional';
      optional.textContent = 'необязательно';
      titleWrap.append(optional);
    }
    if (field.help) {
      const help = document.createElement('p');
      help.className = 'brief-question-help';
      help.textContent = field.help;
      titleWrap.append(help);
    }
    heading.append(number, titleWrap);

    let control;
    if (field.type === 'text' || field.type === 'textarea') control = createTextControl(field);
    if (field.type === 'checks') control = createChoices(field, 'checkbox');
    if (field.type === 'radio') control = createChoices(field, 'radio');
    if (field.type === 'select-detail') control = createSelectDetail(field);

    section.append(heading, control);
    els.briefFields.append(section);
  });
}

function fieldHasAnswer(field) {
  const raw = state.answers[field.id];
  if (Array.isArray(raw) && raw.length) return true;
  if (String(raw || '').trim()) return true;
  if (String(state.details[field.id] || '').trim()) return true;
  if (String(state.others[field.id] || '').trim()) return true;
  return false;
}

function refreshCompletionClasses() {
  $$('[data-brief-question]').forEach((node) => {
    const field = BRIEF_FIELDS.find((item) => item.id === node.dataset.briefQuestion);
    node.classList.toggle('complete', field ? fieldHasAnswer(field) : false);
  });
}

function updateOutputClean() {
  state.projectTitle = els.briefProjectTitle.value;
  els.briefOutput.value = buildBriefText(state);
  const completed = countCompletedBriefFields(state);
  const total = BRIEF_FIELDS.length;
  els.briefProgressValue.textContent = `${completed} из ${total}`;
  els.briefProgressBar.style.width = `${Math.round((completed / total) * 100)}%`;
  refreshCompletionClasses();
  scheduleSave();
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
  link.download = sanitizeBriefFilename(state.projectTitle);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Текстовый файл подготовлен');
}

function clearBrief() {
  if (!confirm('Очистить все ответы брифа?')) return;
  state = emptyBriefData();
  localStorage.removeItem(STORAGE_KEY);
  els.briefProjectTitle.value = '';
  renderFields();
  updateOutputClean();
  showToast('Бриф очищен');
}

function activateView(view, updateHash = true) {
  const isBrief = view === 'brief';
  els.reviewView.classList.toggle('hidden', isBrief);
  els.briefView.classList.toggle('hidden', !isBrief);
  els.reviewTopActions.classList.toggle('hidden', isBrief);
  els.navButtons.forEach((button) => {
    const active = button.dataset.appView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.brandTitle.textContent = isBrief ? 'Видео · Бриф' : 'Видео · Правки';
  els.brandSubtitle.textContent = isBrief ? 'заявка на видеопроизводство' : 'внутренний сервис продакшена';
  document.title = isBrief ? 'Бриф на видео — Продакшн' : 'Правки по видео — Продакшн';
  if (updateHash) history.replaceState(null, '', isBrief ? '#brief' : '#review');
  if (isBrief) updateOutputClean();
}

els.briefProjectTitle.value = state.projectTitle || '';
renderFields();
updateOutputClean();

els.briefProjectTitle.addEventListener('input', updateOutputClean);
els.copyBriefBtn.addEventListener('click', copyBrief);
els.downloadBriefBtn.addEventListener('click', downloadBrief);
els.clearBriefBtn.addEventListener('click', clearBrief);
els.navButtons.forEach((button) => button.addEventListener('click', () => activateView(button.dataset.appView)));
window.addEventListener('hashchange', () => activateView(location.hash === '#brief' ? 'brief' : 'review', false));
activateView(location.hash === '#brief' ? 'brief' : 'review', false);

window.PRAVOCHNAYA_BRIEF_API = Object.freeze({
  getSnapshot: () => JSON.parse(JSON.stringify(state)),
  getText: () => buildBriefText(state),
  open: () => activateView('brief'),
});
