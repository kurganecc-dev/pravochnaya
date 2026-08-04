export const BRIEF_SECTIONS = Object.freeze([
  {
    id: 'contacts',
    number: '01',
    title: 'Проект и согласование',
    shortTitle: 'Контакты',
    description: 'Кто ставит задачу, кто принимает решение и от кого приходит единый список правок.',
  },
  {
    id: 'task',
    number: '02',
    title: 'Задача и аудитория',
    shortTitle: 'Задача',
    description: 'Зачем нужен ролик, какую мысль он должен донести и что зритель сделает после просмотра.',
  },
  {
    id: 'content',
    number: '03',
    title: 'Содержание и стиль',
    shortTitle: 'Содержание',
    description: 'Сценарий, обязательные материалы, стилистика, графика, голос и субтитры.',
  },
  {
    id: 'shooting',
    number: '04',
    title: 'Организация съёмки',
    shortTitle: 'Съёмка',
    description: 'Локации, участники, доступ, ограничения и ответственные на площадке.',
  },
  {
    id: 'deliverables',
    number: '05',
    title: 'Результат и сроки',
    shortTitle: 'Результат',
    description: 'Хронометраж, версии ролика, даты черновика, финала и публикации.',
  },
  {
    id: 'resources',
    number: '06',
    title: 'Бюджет и материалы',
    shortTitle: 'Ресурсы',
    description: 'Что уже есть у заказчика, что организует продакшен и как будет проходить приёмка.',
  },
]);

const SHOOTING_VALUES = ['Новая съёмка', 'Съёмка + готовые материалы'];

export const BRIEF_FIELDS = Object.freeze([
  {
    id: 'projectTitle',
    section: 'contacts',
    title: 'Название проекта или задачи',
    outputLabel: 'Проект / задача',
    type: 'text',
    required: true,
    placeholder: 'Например: Имиджевый ролик о новом продукте',
    help: 'Короткое название, по которому задачу можно найти в переписке и производственном плане.',
  },
  {
    id: 'contact',
    section: 'contacts',
    title: 'Ваши контакты',
    outputLabel: 'Контакт заказчика',
    type: 'text',
    required: true,
    placeholder: '@telegram, имя и номер телефона',
  },
  {
    id: 'department',
    section: 'contacts',
    title: 'Подразделение или команда',
    outputLabel: 'Подразделение',
    type: 'text',
    placeholder: 'Например: Отдел маркетинга, город, проектная команда',
    optional: true,
  },
  {
    id: 'initiator',
    section: 'contacts',
    title: 'Кто ставит задачу и отвечает за материалы',
    outputLabel: 'Инициатор и ответственный за материалы',
    type: 'text',
    required: true,
    placeholder: 'Имя, роль и контакт, если это не вы',
  },
  {
    id: 'approver',
    section: 'contacts',
    title: 'Кто принимает финальное решение',
    outputLabel: 'Финальное согласование',
    type: 'text',
    required: true,
    placeholder: 'Имя и должность человека, утверждающего результат',
  },
  {
    id: 'feedbackOwner',
    section: 'contacts',
    title: 'Кто собирает единый список правок',
    outputLabel: 'Единый список правок собирает',
    type: 'text',
    required: true,
    placeholder: 'Один ответственный, от которого придут итоговые комментарии',
    help: 'Это защищает проект от противоречащих друг другу правок разных согласующих.',
  },
  {
    id: 'otherReviewers',
    section: 'contacts',
    title: 'Кто ещё участвует в согласовании',
    outputLabel: 'Другие согласующие',
    type: 'textarea',
    rows: 3,
    placeholder: 'Имена, роли и на каком этапе они подключаются',
    optional: true,
  },

  {
    id: 'videoTypes',
    section: 'task',
    title: 'Тип ролика',
    outputLabel: 'Тип ролика',
    type: 'checks',
    required: true,
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
      'Видео для мероприятия',
      'Внутренняя коммуникация',
    ],
    other: true,
  },
  {
    id: 'objective',
    section: 'task',
    title: 'Главная задача ролика',
    outputLabel: 'Главная задача',
    type: 'radio',
    required: true,
    options: [
      'Привлечь заявки или продажи',
      'Рассказать о продукте или услуге',
      'Повысить узнаваемость',
      'Обучить или объяснить процесс',
      'Пригласить на мероприятие',
      'Показать итоги события',
      'Презентовать объект или проект',
      'Решить внутреннюю коммуникационную задачу',
    ],
    other: true,
  },
  {
    id: 'objectiveDetails',
    section: 'task',
    title: 'Как поймём, что ролик сработал',
    outputLabel: 'Ожидаемый результат',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Например: сотрудники зарегистрируются на мероприятие, клиенты оставят заявку, руководители поймут новый процесс',
  },
  {
    id: 'mainMessage',
    section: 'task',
    title: 'Какую одну мысль зритель должен запомнить',
    outputLabel: 'Главная мысль',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Одно предложение без перечисления всех преимуществ',
    help: 'Главная мысль помогает не перегрузить сценарий второстепенной информацией.',
  },
  {
    id: 'viewerAction',
    section: 'task',
    title: 'Что зритель должен сделать после просмотра',
    outputLabel: 'Целевое действие зрителя',
    type: 'textarea',
    required: true,
    rows: 3,
    placeholder: 'Оставить заявку, перейти по ссылке, зарегистрироваться, запомнить информацию, обсудить с руководителем…',
  },
  {
    id: 'desiredEmotion',
    section: 'task',
    title: 'Что зритель должен почувствовать',
    outputLabel: 'Желаемая эмоция',
    type: 'checks',
    required: true,
    options: [
      'Доверие',
      'Интерес',
      'Желание участвовать',
      'Ощущение масштаба',
      'Спокойствие и уверенность',
      'Срочность',
      'Гордость',
      'Удивление',
    ],
    other: true,
  },
  {
    id: 'audienceWho',
    section: 'task',
    title: 'Кто целевая аудитория',
    outputLabel: 'Целевая аудитория',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Кто эти люди, какая у них роль, опыт и насколько они знакомы с темой',
  },
  {
    id: 'audienceInsight',
    section: 'task',
    title: 'Что для аудитории важно и что мешает принять решение',
    outputLabel: 'Мотивация и барьеры аудитории',
    type: 'textarea',
    rows: 4,
    placeholder: 'Что их беспокоит, в чём они сомневаются, на какие аргументы реагируют',
    optional: true,
  },
  {
    id: 'platforms',
    section: 'task',
    title: 'Где будет опубликовано или показано видео',
    outputLabel: 'Площадки размещения',
    type: 'checks',
    required: true,
    options: [
      'Telegram',
      'VK',
      'Rutube',
      'YouTube',
      'Сайт или лендинг',
      'Внутренний портал',
      'Экран в офисе',
      'Мероприятие',
      'Презентация',
      'Рекламное размещение',
    ],
    other: true,
  },

  {
    id: 'toneStyle',
    section: 'content',
    title: 'Тон и стилистика',
    outputLabel: 'Тон и стилистика',
    type: 'checks',
    required: true,
    help: 'Выберите характеристики, которые лучше всего описывают желаемое видео.',
    options: [
      'Официально',
      'Неформально',
      'Динамично',
      'Спокойно',
      'Эмоционально',
      'Рационально и по делу',
      'Премиально',
      'Просто и понятно',
      'Серьёзно',
      'С юмором',
      'Реалистично',
      'Рекламно и постановочно',
    ],
    other: true,
  },
  {
    id: 'references',
    section: 'content',
    title: 'Референсы',
    outputLabel: 'Референсы',
    type: 'textarea',
    rows: 4,
    placeholder: 'Ссылки — по одной на строку. Под каждой напишите, что именно нравится.',
    optional: true,
  },
  {
    id: 'antiReferences',
    section: 'content',
    title: 'Антиреференсы: как точно не надо',
    outputLabel: 'Антиреференсы и нежелательная стилистика',
    type: 'textarea',
    rows: 4,
    placeholder: 'Ссылки или описание решений, которых нужно избегать',
    optional: true,
  },
  {
    id: 'mandatoryContent',
    section: 'content',
    title: 'Что обязательно должно прозвучать или появиться в кадре',
    outputLabel: 'Обязательные элементы',
    type: 'textarea',
    required: true,
    rows: 5,
    placeholder: 'Тезисы, цифры, логотипы, имена, должности, адреса, ссылки, юридические формулировки. Если обязательных элементов нет — напишите «Нет».',
  },
  {
    id: 'forbiddenContent',
    section: 'content',
    title: 'Что нельзя показывать, говорить или обещать',
    outputLabel: 'Запрещённые элементы и ограничения',
    type: 'textarea',
    rows: 4,
    placeholder: 'Конфиденциальные данные, нежелательные формулировки, люди или зоны, которые нельзя снимать',
    optional: true,
  },
  {
    id: 'scriptStatus',
    section: 'content',
    title: 'В каком состоянии сценарий',
    outputLabel: 'Сценарий',
    type: 'radio',
    required: true,
    options: [
      'Есть готовый и согласованный сценарий',
      'Есть черновик сценария',
      'Есть только тезисы',
      'Сценарий должен подготовить продакшен',
      'Сценарий не требуется',
    ],
  },
  {
    id: 'scriptMaterials',
    section: 'content',
    title: 'Ссылка на сценарий, черновик или тезисы',
    outputLabel: 'Материалы сценария',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Вставьте ссылку или кратко перечислите ключевые сцены и тезисы',
    dependsOn: {
      id: 'scriptStatus',
      values: [
        'Есть готовый и согласованный сценарий',
        'Есть черновик сценария',
        'Есть только тезисы',
      ],
    },
  },
  {
    id: 'graphics',
    section: 'content',
    title: 'Нужна ли графика или инфографика',
    outputLabel: 'Графика и инфографика',
    type: 'radio',
    required: true,
    options: [
      'Нет',
      'Только титры и подписи',
      'Анимационная инфографика',
      'Полноценная моушн-графика',
      'Нужна рекомендация продакшена',
    ],
    detailPlaceholder: 'Какие данные, цифры, схемы, таблицы, карты или элементы нужно показать',
    detailWhen: [
      'Только титры и подписи',
      'Анимационная инфографика',
      'Полноценная моушн-графика',
    ],
    detailRequiredWhen: [
      'Только титры и подписи',
      'Анимационная инфографика',
      'Полноценная моушн-графика',
    ],
  },
  {
    id: 'voiceover',
    section: 'content',
    title: 'Нужна ли озвучка',
    outputLabel: 'Озвучка',
    type: 'radio',
    required: true,
    options: [
      'Нет',
      'Запишем своими силами',
      'Нужен профессиональный диктор',
      'Нужен ведущий в кадре',
      'Нужна рекомендация продакшена',
    ],
    detailPlaceholder: 'Язык, пол, возраст и характер голоса; кто предоставляет текст озвучки',
    detailWhen: [
      'Запишем своими силами',
      'Нужен профессиональный диктор',
      'Нужен ведущий в кадре',
    ],
    detailRequiredWhen: [
      'Запишем своими силами',
      'Нужен профессиональный диктор',
      'Нужен ведущий в кадре',
    ],
  },
  {
    id: 'subtitles',
    section: 'content',
    title: 'Нужны ли субтитры и языковые версии',
    outputLabel: 'Субтитры и языки',
    type: 'radio',
    required: true,
    options: [
      'Субтитры не нужны',
      'Нужны вшитые субтитры',
      'Нужен отдельный файл субтитров',
      'Нужны версии на нескольких языках',
      'Нужна рекомендация продакшена',
    ],
    detailPlaceholder: 'Языки, наличие перевода и требования к оформлению',
    detailWhen: [
      'Нужны вшитые субтитры',
      'Нужен отдельный файл субтитров',
      'Нужны версии на нескольких языках',
    ],
    detailRequiredWhen: [
      'Нужны вшитые субтитры',
      'Нужен отдельный файл субтитров',
      'Нужны версии на нескольких языках',
    ],
  },

  {
    id: 'productionMode',
    section: 'shooting',
    title: 'Как будет производиться ролик',
    outputLabel: 'Формат производства',
    type: 'radio',
    required: true,
    options: [
      'Новая съёмка',
      'Монтаж из готовых материалов',
      'Съёмка + готовые материалы',
      'Пока не определено',
    ],
  },
  {
    id: 'location',
    section: 'shooting',
    title: 'Место проведения съёмки',
    outputLabel: 'Локация',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Адрес, тип помещения, этаж, парковка, несколько локаций',
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'shootDate',
    section: 'shooting',
    title: 'Желаемая дата или период съёмки',
    outputLabel: 'Дата съёмки',
    type: 'text',
    required: true,
    placeholder: 'Например: 15–18 сентября, точная дата пока не определена',
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'participants',
    section: 'shooting',
    title: 'Кто будет в кадре',
    outputLabel: 'Участники съёмки',
    type: 'checks',
    required: true,
    options: [
      'Сотрудники',
      'Руководитель',
      'Клиенты',
      'Эксперты или спикеры',
      'Профессиональные актёры',
      'Ведущий',
      'Массовка',
      'Людей в кадре не будет',
      'Пока не определено',
    ],
    other: true,
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'participantDetails',
    section: 'shooting',
    title: 'Что важно знать об участниках',
    outputLabel: 'Детали по участникам',
    type: 'textarea',
    rows: 4,
    placeholder: 'Количество, опыт в кадре, доступность, одежда, необходимость визажиста или стилиста',
    optional: true,
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'participantOrganizer',
    section: 'shooting',
    title: 'Кто собирает участников и подтверждает их готовность',
    outputLabel: 'Организация участников',
    type: 'text',
    required: true,
    placeholder: 'Имя и контакт ответственного',
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'onsiteContact',
    section: 'shooting',
    title: 'Контакт ответственного на площадке',
    outputLabel: 'Ответственный на площадке',
    type: 'text',
    required: true,
    placeholder: 'Имя, Telegram или телефон',
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'accessRestrictions',
    section: 'shooting',
    title: 'Доступ, режим работы и ограничения площадки',
    outputLabel: 'Доступ и ограничения площадки',
    type: 'textarea',
    rows: 4,
    placeholder: 'Пропуска, время доступа, шум, электричество, запретные зоны, согласования службы безопасности',
    optional: true,
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },
  {
    id: 'props',
    section: 'shooting',
    title: 'Нужны ли реквизит, одежда, транспорт или подготовка пространства',
    outputLabel: 'Реквизит и подготовка',
    type: 'textarea',
    rows: 4,
    placeholder: 'Что уже есть и что должен организовать продакшен',
    optional: true,
    dependsOn: { id: 'productionMode', values: SHOOTING_VALUES },
  },

  {
    id: 'duration',
    section: 'deliverables',
    title: 'Желаемый хронометраж',
    outputLabel: 'Хронометраж',
    type: 'text',
    required: true,
    placeholder: 'Например: до 60 секунд или 4 ролика по 2–3 минуты',
  },
  {
    id: 'formats',
    section: 'deliverables',
    title: 'Какие форматы и ориентации нужны',
    outputLabel: 'Форматы и ориентации',
    type: 'checks',
    required: true,
    options: [
      'Горизонтальный 16:9',
      'Вертикальный 9:16',
      'Квадратный 1:1',
      'Вертикальный 4:5',
      'Несколько адаптаций',
      'Нужна рекомендация продакшена',
    ],
    other: true,
  },
  {
    id: 'additionalDeliverables',
    section: 'deliverables',
    title: 'Какие дополнительные версии и файлы нужны',
    outputLabel: 'Дополнительные результаты',
    type: 'checks',
    options: [
      'Короткий тизер',
      'Нарезка отдельных фрагментов',
      'Обложка или превью',
      'Версия без титров',
      'Версия без музыки',
      'Исходники',
      'Проект монтажа',
      'Дополнительные версии не нужны',
      'Нужна рекомендация продакшена',
    ],
    other: true,
    optional: true,
  },
  {
    id: 'firstDraftDate',
    section: 'deliverables',
    title: 'Когда нужен первый черновик',
    outputLabel: 'Первый черновик',
    type: 'text',
    placeholder: 'Дата или период',
    optional: true,
  },
  {
    id: 'finalDeadline',
    section: 'deliverables',
    title: 'Крайний срок готового ролика',
    outputLabel: 'Крайний срок финала',
    type: 'text',
    required: true,
    placeholder: 'Конкретная дата и время, если это важно',
  },
  {
    id: 'publicationDate',
    section: 'deliverables',
    title: 'Когда ролик будет опубликован или показан',
    outputLabel: 'Дата публикации / показа',
    type: 'text',
    required: true,
    placeholder: 'Дата публикации, мероприятия или запуска кампании',
    help: 'Реальная дата показа помогает правильно запланировать запас на согласование и исправления.',
  },
  {
    id: 'technicalRequirements',
    section: 'deliverables',
    title: 'Есть ли технические требования площадки или экрана',
    outputLabel: 'Технические требования',
    type: 'textarea',
    rows: 4,
    placeholder: 'Разрешение, кодек, размер файла, безопасные зоны, громкость, требования рекламной площадки. Обычное разрешение продакшен определит сам.',
    optional: true,
  },

  {
    id: 'budget',
    section: 'resources',
    title: 'Бюджет задачи',
    outputLabel: 'Бюджет',
    type: 'radio',
    required: true,
    options: [
      'Бесплатно / внутренними силами',
      'До 30 000 ₽',
      '30 000–70 000 ₽',
      '70 000–150 000 ₽',
      'Свыше 150 000 ₽',
      'Бюджет ещё не согласован',
      'Нужна оценка нескольких вариантов',
    ],
    other: true,
    detailPlaceholder: 'ЦФО, источник бюджета, верхняя граница или важные финансовые ограничения',
    detailWhen: [
      'Бесплатно / внутренними силами',
      'До 30 000 ₽',
      '30 000–70 000 ₽',
      '70 000–150 000 ₽',
      'Свыше 150 000 ₽',
      'Бюджет ещё не согласован',
      'Нужна оценка нескольких вариантов',
    ],
  },
  {
    id: 'providedMaterials',
    section: 'resources',
    title: 'Какие материалы уже есть',
    outputLabel: 'Материалы заказчика',
    type: 'checks',
    options: [
      'Логотип',
      'Брендбук',
      'Сценарий или тезисы',
      'Презентация',
      'Фотографии',
      'Архивные видео',
      'Тексты',
      'Графика или иллюстрации',
      'Музыка',
      'План помещения или объекта',
      'Материалов пока нет',
    ],
    other: true,
    optional: true,
  },
  {
    id: 'materialsLinks',
    section: 'resources',
    title: 'Ссылки на материалы',
    outputLabel: 'Ссылки на материалы',
    type: 'textarea',
    rows: 4,
    placeholder: 'Ссылки на Яндекс Диск, документы, брендбук, фотографии и другие материалы',
    optional: true,
  },
  {
    id: 'productionNeeds',
    section: 'resources',
    title: 'Что должен организовать продакшен',
    outputLabel: 'Зона ответственности продакшена',
    type: 'checks',
    required: true,
    options: [
      'Разработка идеи',
      'Сценарий',
      'Съёмочная команда',
      'Поиск площадки',
      'Ведущий или актёры',
      'Диктор',
      'Графика и анимация',
      'Музыка и звук',
      'Адаптации под площадки',
      'Нужна рекомендация по составу работ',
    ],
    other: true,
  },
  {
    id: 'approvalRounds',
    section: 'resources',
    title: 'Сколько этапов согласования планируется',
    outputLabel: 'Этапы согласования',
    type: 'radio',
    required: true,
    options: [
      'Один общий раунд правок',
      'Два раунда правок',
      'Три и более раунда',
      'Пока не определено',
    ],
  },
  {
    id: 'feedbackAgreement',
    section: 'resources',
    title: 'Как будут передаваться правки',
    outputLabel: 'Порядок передачи правок',
    type: 'radio',
    required: true,
    options: [
      'Все согласующие объединяют комментарии в один список',
      'Правки передаёт один ответственный',
      'Нужна помощь продакшена с организацией согласования',
    ],
  },
  {
    id: 'additionalComments',
    section: 'resources',
    title: 'Дополнительная информация',
    outputLabel: 'Дополнительные комментарии',
    type: 'textarea',
    rows: 5,
    placeholder: 'Риски, ограничения, особенности проекта или всё, что не вошло в предыдущие разделы',
    optional: true,
  },
]);

function cleanText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function optionMatches(raw, values = []) {
  if (Array.isArray(raw)) return raw.some((value) => values.includes(value));
  return values.includes(cleanText(raw));
}

export function isBriefFieldVisible(field, data) {
  if (!field.dependsOn) return true;
  const normalized = normalizeBriefData(data, { migrate: false });
  return optionMatches(normalized.answers[field.dependsOn.id], field.dependsOn.values);
}

export function getVisibleBriefFields(data) {
  return BRIEF_FIELDS.filter((field) => isBriefFieldVisible(field, data));
}

export function emptyBriefData() {
  return {
    version: 2,
    answers: Object.fromEntries(BRIEF_FIELDS.map((field) => [field.id, field.type === 'checks' ? [] : ''])),
    details: {},
    others: {},
    updatedAt: null,
  };
}

function assignMigrated(base, id, value) {
  const field = BRIEF_FIELDS.find((item) => item.id === id);
  if (!field || value === undefined || value === null) return;
  if (field.type === 'checks') {
    base.answers[id] = Array.isArray(value)
      ? value.map(cleanText).filter(Boolean)
      : cleanText(value) ? [cleanText(value)] : [];
  } else {
    base.answers[id] = cleanText(value);
  }
}

function migrateLegacyBrief(raw, base) {
  assignMigrated(base, 'projectTitle', raw.projectTitle);
  const map = {
    q01: 'contact',
    q02: 'approver',
    q03: 'videoTypes',
    q04: 'objectiveDetails',
    q05: 'toneStyle',
    q06: 'audienceWho',
    q07: 'duration',
    q08: 'references',
    q09: 'location',
    q10: 'graphics',
    q11: 'voiceover',
    q12: 'formats',
    q13: 'finalDeadline',
    q14: 'budget',
    q15: 'scriptMaterials',
    q16: 'technicalRequirements',
  };
  Object.entries(map).forEach(([legacyId, newId]) => assignMigrated(base, newId, raw.answers?.[legacyId]));
  if (cleanText(raw.answers?.q15)) base.answers.scriptStatus = 'Есть черновик сценария';
  if (raw.details?.q10) base.details.graphics = cleanText(raw.details.q10);
  if (raw.details?.q14) base.details.budget = cleanText(raw.details.q14);
  if (raw.others?.q03) base.others.videoTypes = cleanText(raw.others.q03);
  if (raw.others?.q05) base.others.toneStyle = cleanText(raw.others.q05);
}

export function normalizeBriefData(raw, options = {}) {
  const base = emptyBriefData();
  if (!raw || typeof raw !== 'object') return base;

  const shouldMigrate = options.migrate !== false && (!raw.version || raw.version < 2);
  if (shouldMigrate) migrateLegacyBrief(raw, base);

  BRIEF_FIELDS.forEach((field) => {
    if (!raw.answers || !Object.hasOwn(raw.answers, field.id)) return;
    const value = raw.answers[field.id];
    if (field.type === 'checks') {
      base.answers[field.id] = Array.isArray(value)
        ? value.map(cleanText).filter(Boolean)
        : [];
    } else {
      base.answers[field.id] = cleanText(value);
    }
  });

  BRIEF_FIELDS.forEach((field) => {
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

function detailIsActive(field, normalized) {
  if (!field.detailPlaceholder) return false;
  if (!field.detailWhen?.length) return true;
  return optionMatches(normalized.answers[field.id], field.detailWhen);
}

export function getBriefAnswer(data, field) {
  const normalized = normalizeBriefData(data, { migrate: false });
  if (!isBriefFieldVisible(field, normalized)) return '';

  const raw = normalized.answers[field.id];
  const other = cleanText(normalized.others[field.id]);
  const detail = detailIsActive(field, normalized) ? cleanText(normalized.details[field.id]) : '';
  let answer = '';

  if (field.type === 'checks') {
    const values = Array.isArray(raw) ? [...raw] : [];
    if (other) values.push(other);
    answer = values.join(', ');
  } else {
    answer = cleanText(raw);
    if (other) answer = answer ? `${answer}, ${other}` : other;
  }

  if (answer && detail) return `${answer}. ${detail}`;
  return answer || detail;
}

export function countCompletedBriefFields(data) {
  return getVisibleBriefFields(data).reduce(
    (count, field) => count + (getBriefAnswer(data, field) ? 1 : 0),
    0,
  );
}

export function getBriefReadiness(data) {
  const normalized = normalizeBriefData(data, { migrate: false });
  const visibleFields = getVisibleBriefFields(normalized);
  const requirements = [];

  visibleFields.forEach((field) => {
    if (field.required) {
      requirements.push({
        id: field.id,
        fieldId: field.id,
        section: field.section,
        title: field.title,
        complete: Boolean(getBriefAnswer(normalized, field)),
      });
    }
    if (field.detailRequiredWhen?.length && optionMatches(normalized.answers[field.id], field.detailRequiredWhen)) {
      requirements.push({
        id: `${field.id}__detail`,
        fieldId: field.id,
        section: field.section,
        title: `Уточните: ${field.title}`,
        complete: Boolean(cleanText(normalized.details[field.id])),
      });
    }
  });

  const missing = requirements.filter((item) => !item.complete);
  const completed = requirements.length - missing.length;
  const percent = requirements.length ? Math.round((completed / requirements.length) * 100) : 100;
  return {
    ready: missing.length === 0,
    percent,
    completed,
    total: requirements.length,
    missing: missing.map(({ complete, ...item }) => item),
  };
}

export function getBriefSectionProgress(data, sectionId) {
  const normalized = normalizeBriefData(data, { migrate: false });
  const fields = getVisibleBriefFields(normalized).filter((field) => field.section === sectionId);
  const requirements = [];
  fields.forEach((field) => {
    if (field.required) requirements.push(Boolean(getBriefAnswer(normalized, field)));
    if (field.detailRequiredWhen?.length && optionMatches(normalized.answers[field.id], field.detailRequiredWhen)) {
      requirements.push(Boolean(cleanText(normalized.details[field.id])));
    }
  });
  const completedRequired = requirements.filter(Boolean).length;
  const answered = fields.filter((field) => getBriefAnswer(normalized, field)).length;
  return {
    fields: fields.length,
    answered,
    required: requirements.length,
    completedRequired,
    complete: requirements.length === completedRequired,
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function valueOrDash(data, id) {
  const field = BRIEF_FIELDS.find((item) => item.id === id);
  return field ? getBriefAnswer(data, field) || '—' : '—';
}

export function buildBriefText(data, options = {}) {
  const normalized = normalizeBriefData(data);
  const date = options.date instanceof Date ? options.date : new Date();
  const readiness = getBriefReadiness(normalized);
  const lines = [
    'БРИФ НА ВИДЕОПРОИЗВОДСТВО',
    `Дата заполнения: ${formatDate(date)}`,
    `Статус: ${readiness.ready ? 'готов к предварительной оценке' : `нужно уточнить ${readiness.missing.length} пункт(а)`}`,
    '',
    'КРАТКАЯ СВОДКА',
    `Проект: ${valueOrDash(normalized, 'projectTitle')}`,
    `Тип ролика: ${valueOrDash(normalized, 'videoTypes')}`,
    `Главная задача: ${valueOrDash(normalized, 'objective')}`,
    `Площадки: ${valueOrDash(normalized, 'platforms')}`,
    `Форматы: ${valueOrDash(normalized, 'formats')}`,
    `Крайний срок: ${valueOrDash(normalized, 'finalDeadline')}`,
    `Бюджет: ${valueOrDash(normalized, 'budget')}`,
  ];

  BRIEF_SECTIONS.forEach((section) => {
    const fields = getVisibleBriefFields(normalized).filter((field) => field.section === section.id);
    const rows = fields
      .map((field) => ({ field, answer: getBriefAnswer(normalized, field) }))
      .filter(({ field, answer }) => answer || field.required);

    if (!rows.length) return;
    lines.push('', `${section.number}. ${section.title.toUpperCase()}`);
    rows.forEach(({ field, answer }) => {
      lines.push(`${field.outputLabel || field.title}: ${answer || '— Не указано'}`);
    });
  });

  if (readiness.missing.length) {
    lines.push('', 'НЕ ХВАТАЕТ ДЛЯ ОЦЕНКИ');
    readiness.missing.forEach((item) => lines.push(`• ${item.title}`));
  }

  lines.push('', 'Важно: правки от всех согласующих должны быть объединены в один непротиворечивый список.');
  return lines.join('\n').trimEnd();
}

export function sanitizeBriefFilename(value) {
  const normalized = normalizeBriefData(value && typeof value === 'object' ? value : null);
  const raw = value && typeof value === 'object'
    ? normalized.answers.projectTitle
    : value;
  const cleaned = cleanText(raw || 'brief-video')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${cleaned || 'brief-video'}.txt`;
}
