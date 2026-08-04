# Видео · Правки — GitHub Pages

Версия сервиса, адаптированная для GitHub Pages.

## Что изменено

- ZIP-отчёт собирается прямо в браузере через локально подключённый JSZip;
- Python-сервер для экспорта больше не нужен;
- Яндекс Диск работает через отдельный Cloudflare Worker;
- Worker поддерживает CORS и Range-запросы, поэтому видео можно перематывать и сохранять кадры с пометками;
- адрес корпоративного Worker уже зашит в сайт;
- добавлены GitHub Actions для публикации Pages и Worker.

## Структура

```text
docs/                     статический сайт GitHub Pages
worker/                   Cloudflare Worker для Яндекс Диска
.github/workflows/        автоматическая публикация
```

## Шаг 1. Загрузите проект в GitHub

Создайте репозиторий и загрузите в него содержимое этой папки:

```bash
git init
git add .
git commit -m "Video review service"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## Шаг 2. Cloudflare Worker уже подключён

Корпоративный Worker уже развёрнут и указан в `docs/config.js`:

```js
window.VIDEO_REVIEW_CONFIG = {
  apiBaseUrl: 'https://video-review-yandex-api.kurganecc.workers.dev',
};
```

Этот шаг пользователю выполнять не нужно. Папка `worker` сохранена только для резервного развёртывания или будущих изменений.

### Необязательное повторное развёртывание Worker

```bash
cd worker
npm install
npx wrangler login
npm run deploy
```

После смены Worker замените адрес в `docs/config.js`.

## Шаг 3. Включите GitHub Pages

Откройте:

```text
Settings → Pages → Build and deployment
```

Выберите источник:

```text
GitHub Actions
```

Workflow `pages.yml` опубликует папку `docs`.

## Ограничение доступа

По умолчанию Worker разрешает запросы с любых сайтов:

```json
"ALLOWED_ORIGINS": "*"
```

После проверки лучше заменить значение в `worker/wrangler.jsonc` на адрес вашего GitHub Pages:

```json
"ALLOWED_ORIGINS": "https://USERNAME.github.io"
```

Для нескольких доменов используйте строку через запятую.

## Работает на GitHub Pages

- загрузка локального видео;
- прямые ссылки на видео с корректным CORS;
- публичные видео Яндекс Диска через Worker;
- таймкоды и комментарии;
- статусы, сортировка и фильтры;
- рисование поверх кадра;
- скриншоты с пометками;
- скачивание отдельных кадров;
- экспорт JSON, CSV и TXT;
- ZIP с `project.json`, `comments.csv`, `comments.txt`, `report.html` и папкой `screenshots`;
- автосохранение в браузере.

## Локальная проверка

Сайт:

```bash
python3 -m http.server 8080 --directory docs
```

Worker:

```bash
cd worker
npm install
npm run dev
```

## Экспорт в Adobe Premiere Pro

В рабочую версию Правочной добавлен новый формат экспорта без изменения основного интерфейса и сценария добавления правок.

Откройте **Экспорт → Adobe Premiere Pro**, укажите FPS, разрешение и стартовый таймкод, затем скачайте ZIP. Архив содержит:

- `pravochnaya-premiere.xml` — Final Cut Pro 7 XML для импорта в Premiere Pro;
- sequence markers с полным текстом правок;
- прозрачные PNG-карточки на нужных таймкодах;
- `comments.csv`;
- резервную копию `project.json`;
- исходные скриншоты;
- `README-PREMIERE.txt` с инструкцией монтажёру.

В Premiere Pro выберите **Файл → Импорт**, откройте XML и при необходимости выполните **Link Media / Связать медиа**, указав папку `overlays`.

Важно: FPS, разрешение и стартовый таймкод при экспорте должны совпадать с монтажной секвенцией.

### Проверка перед публикацией

```bash
npm test
npm run check
```
