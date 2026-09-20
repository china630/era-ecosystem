/** Public landing copy — separate module so Next.js does not tree-shake it from `resources.ts`. */

import type { Locale } from "@era/i18n-common";
import { landingEcosystemAz, landingEcosystemRu, type LandingEcosystemCopy } from "./landing-ecosystem-data";

export type {
  EcosystemModuleCopy,
  EcosystemModuleStatus,
  EcosystemSectionCopy,
  LandingEcosystemCopy,
} from "./landing-ecosystem-data";

export type LandingPageCopy = {
  heroTitle: string;
  heroSubtitle: string;
  disclaimer: string;
  ctaRegister: string;
  ctaPricing: string;
  navPricing: string;
};

export type LandingFeatureCopy = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
};

export type LandingPremiumItemCopy = {
  slug: string;
  name: string;
  description: string;
  highlights: string[];
};

export type LandingLegacyCompareRow = {
  topic: string;
  legacy: string;
  era: string;
};

export type LandingLegacyCompareCopy = {
  title: string;
  subtitle: string;
  legacyBrand: string;
  eraBrand: string;
  rows: LandingLegacyCompareRow[];
};

export type LandingZeroKnowledgeClaim = {
  title: string;
  detail: string;
};

export type LandingZeroKnowledgeCopy = {
  title: string;
  claims: LandingZeroKnowledgeClaim[];
  identityEyebrow: string;
  encryptionNote: string;
  badges: string[];
};

export type LandingHubCopy = {
  coreTitle: string;
  coreBody: string;
  coreCta: string;
  satellitesTitle: string;
  satellitesIntro: string;
  dataHubTitle: string;
  dataHubBody: string;
  dataHubCta: string;
  addonsTitle: string;
  addonsBody: string;
  addonsCta: string;
  catalogCta: string;
};

export type LandingMarketingCopy = {
  chrome: {
    login: string;
    navSatellites: string;
  };
  footer: string;
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaMicrocopy: string;
    navPricing: string;
  };
  hub: LandingHubCopy;
  trial: {
    cornerBadge: string;
    offerPrimary: string;
    offerSubline: string;
    checklistTitle: string;
    checklist: string[];
    disclaimer: string;
  };
  ecosystem: LandingEcosystemCopy;
  zeroKnowledge: LandingZeroKnowledgeCopy;
  legacyCompare: LandingLegacyCompareCopy;
  bottomCta: {
    headline: string;
    subtext: string;
    primary: string;
    secondary: string;
    ctaMicrocopy: string;
  };
  faq: {
    title: string;
    items: { id: string; question: string; answer: string; chips?: string[] }[];
  };
  features: {
    finance: LandingFeatureCopy;
    manufacturing: LandingFeatureCopy;
    tax: LandingFeatureCopy;
  };
  premium: {
    title: string;
    subtitle: string;
    plugInBadge: string;
    items: LandingPremiumItemCopy[];
  };
  mocks: {
    finance: {
      panelTitle: string;
      colDate: string;
      colDescription: string;
      colAmount: string;
      colStatus: string;
      matched: string;
      pending: string;
      rows: { date: string; description: string; amount: string; status: "matched" | "pending" }[];
    };
    manufacturing: {
      panelTitle: string;
      orderId: string;
      statusLabel: string;
      progress: string;
      accountFlow: string;
    };
    tax: {
      panelTitle: string;
      ytdLabel: string;
      limitLabel: string;
      warning: string;
      amount: string;
      limit: string;
    };
  };
};

const landingMarketingRu: LandingMarketingCopy = {
  chrome: {
    login: "Войти",
    navSatellites: "Спутники",
  },
  footer: "ERA 365 — платформа учёта и отраслевых спутников в Азербайджане",
  hero: {
    title: "Учёт и отраслевые спутники — одна платформа",
    subtitle:
      "ERA Core, гостиница, клиника, касса и Data HUB. Палитра 19 / 29 / 39 / 99 AZN. 3 месяца trial без карты.",
    ctaPrimary: "Начать 3 месяца бесплатно",
    ctaSecondary: "Полный каталог",
    ctaMicrocopy: "Без привязки карты • Отмена в любой момент",
    navPricing: "Тарифы",
  },
  hub: {
    coreTitle: "ERA Core",
    coreBody: "Учёт NAS/MMUS: книга, касса, склад, производство, ОС, кадры. Foundation 29 AZN.",
    coreCta: "О ядре Finance",
    satellitesTitle: "Отраслевые спутники",
    satellitesIntro: "Gate — рабочее место и базовая ёмкость. Ядра и пакеты — на странице спутника и в каталоге.",
    dataHubTitle: "Data HUB",
    dataHubBody: "Справочники и обмен. Bronze / Silver / Gold — только один тариф.",
    dataHubCta: "Data HUB",
    addonsTitle: "Платформенные add-on",
    addonsBody: "Уведомления, хранение, лояльность, доставка, Workforce 2/4 AZN. XOR на полке каталога.",
    addonsCta: "Add-on в каталоге",
    catalogCta: "Собрать подписку",
  },
  trial: {
    cornerBadge: "Специальное предложение для старта",
    offerPrimary: "0 AZN / 3 месяца",
    offerSubline: "Foundation и отраслевые Gate в trial",
    checklistTitle: "Активировано в trial",
    checklist: [
      "NAS / MMUS и IFRS / MHBS — двойная запись",
      "Касса, склад, производство, ОС и кадры",
      "Спутники: Hotel, Clinic, F&B, Retail… (Gate)",
      "Документы 1000/мес в NAS; OCR 50 стр.",
    ],
    disclaimer:
      "*Premium Finance (tax_pro, trade_pro, compliance_pro) и production CBS — вне trial list price.",
  },
  ecosystem: landingEcosystemRu,
  zeroKnowledge: {
    title: "Абсолютная конфиденциальность уровня Zero-Knowledge",
    claims: [
      {
        title: "Шифрование на клиенте",
        detail:
          "Данные шифруются в браузере до отправки в сеть — открытый текст не покидает ваше устройство.",
      },
      {
        title: "Нулевой доступ",
        detail:
          "Сотрудники ERA технически не могут просматривать ваши данные: ни учёт, ни спутники.",
      },
      {
        title: "Государственный якорь безопасности",
        detail:
          "Ключи восстановления в крипто-эскроу — разблокировка только через ASAN İmza / SİMA.",
      },
    ],
    identityEyebrow: "Государственная идентичность",
    encryptionNote: "Сквозное шифрование · ключи на стороне клиента",
    badges: ["ASAN İmza", "SİMA"],
  },
  legacyCompare: {
    title: "ERA Finance vs устаревшие платформы 1C",
    subtitle:
      "Восемь раундов head-to-head: почему облачный контур выигрывает у локальной «коробки».",
    legacyBrand: "Старая школа (1С)",
    eraBrand: "ERA Finance",
    rows: [
      {
        topic: "Доступность",
        legacy: "Медленные локальные серверы и VPN — доступ только из офиса",
        era: "Мгновенный облачный веб и мобильный доступ 24/7 из любой точки",
      },
      {
        topic: "Налоговое соответствие",
        legacy: "Платные ручные доработки разработчика при каждом изменении законов",
        era: "Бесплатные мгновенные автообновления под изменения законодательства АР",
      },
      {
        topic: "Госпорталы",
        legacy: "Ручной перенос XML между кабинетами и учётной системой",
        era: "Нативное расширение браузера: e-taxes и e-customs без рутины",
      },
      {
        topic: "Кадры и ƏMAS",
        legacy:
          "Ручная выгрузка штатного расписания, двойной ввод трудовых договоров на портал ƏMAS и риски штрафов из-за задержек",
        era: "Автоматическая бесшовная синхронизация кадрового учета с государственным порталом ƏMAS. Регистрация и закрытие договоров прямо из ERP в 1 клик",
      },
      {
        topic: "WhatsApp",
        legacy: "Дорогие внешние плагины для отправки документов",
        era: "Встроенная отправка счёта и акта контрагенту в 1 клик",
      },
      {
        topic: "Стандарты GAAP",
        legacy: "Изолированные силосы NAS и IFRS — двойной ввод",
        era: "Параллельный NAS/MMUS и IFRS/MHBS в одном контуре",
      },
      {
        topic: "Ввод документов",
        legacy: "Часы ручного ввода по бумажным накладным",
        era: "Нейро-OCR: распознавание и предзаполнение за 5 секунд",
      },
      {
        topic: "Безопасность НДС",
        legacy: "Человеческий фактор и пропуск порога оборота",
        era: "Ежедневный ИИ-Совет Старейшин и страж 200 000 AZN",
      },
    ],
  },
  bottomCta: {
    headline: "Готовы перевести бизнес на сверхзвуковую скорость?",
    subtext: "Зарегистрируйте аккаунт сегодня и получите 3 месяца полного доступа без обязательств",
    primary: "Начать 3 месяца бесплатно",
    secondary: "Войти",
    ctaMicrocopy: "Без привязки карты • Отмена в любой момент",
  },
  faq: {
    title: "Частые вопросы",
    items: [
      {
        id: "what",
        question: "Что такое ERA 365?",
        answer:
          "Платформа учёта (ERA Core) и отраслевых спутников для Азербайджана: гостиница, клиника, касса, логистика и другие рабочие места в одном контуре с MDM и подпиской.",
      },
      {
        id: "pricing",
        question: "Как устроены цены?",
        answer:
          "SKU — палитра 19 / 29 / 39 / 99 AZN. Foundation 29. Gate открывает спутник и базовую ёмкость. Документы, OCR, SMS и хранение считаются метрами. Полный конструктор — на странице тарифов.",
      },
      {
        id: "xor",
        question: "Какие модули нельзя включить вместе?",
        answer: "В каждой группе выбирается только один SKU.",
        chips: [
          "Data HUB Bronze / Silver / Gold",
          "Workforce Base / PRO",
          "Loyalty XOR Retail promo",
          "Delivery XOR F&B hub",
          "Hotel XOR Clinic sanatorium",
        ],
      },
      {
        id: "trial",
        question: "Что входит в 3 месяца trial?",
        answer:
          "Foundation и отраслевые Gate — 0 AZN без карты. Premium Finance и production CBS в trial list не входят. OCR сверх 50 стр. и документы сверх 1000/мес могут начисляться.",
      },
      {
        id: "register",
        question: "Где зарегистрироваться?",
        answer:
          "На app.era-365.online: аккаунт, VÖEN и модули. После входа спутники открываются из launcher. Регистрация не на страницах /industry — они только для авторизованных.",
      },
    ],
  },
  features: {
    finance: {
      eyebrow: "Ядро финансов",
      title: "Касса, банк и сверка без разрывов",
      body: "KMO/KSO, выписки и автоматическое сопоставление платежей — единый журнал денежных потоков с проводками NAS.",
      bullets: [
        "Журнал кассы и банковские карточки в одном контуре",
        "Сверка выписки со счетами и контрагентами",
        "Контроль остатков 101* и 221–224 в реальном времени",
      ],
    },
    manufacturing: {
      eyebrow: "Производство Pro",
      title: "Контроль незавершенного производства",
      body: "Прозрачный WIP: от списания материалов на счёт 201 до накопления затрат на 203 и выпуска готовой продукции.",
      bullets: [
        "BOM и производственные заказы с этапами",
        "Счета 201 → 203 → 204 без «чёрных дыр» в себестоимости",
        "Интеграция со складом и выпуском партий",
      ],
    },
    tax: {
      eyebrow: "Налоговый щит",
      title: "Щит от принудительного НДС",
      body: "Мониторинг оборота YTD против порогов 160k / 190k / 200k AZN — предупреждение до принудительной регистрации плательщика НДС.",
      bullets: [
        "Ежедневный пересчёт лимита по организации",
        "RiskAudit и уведомления при приближении к порогу",
        "Прозрачная картина для собственника и бухгалтера",
      ],
    },
  },
  premium: {
    title: "Премиальные расширения для уверенного роста",
    subtitle:
      "Продвинутые plug-in модули с ИИ и RPA — подключаются поверх операционного ядра, когда бизнес готов к автоматизации compliance и госпорталов.",
    plugInBadge: "Премиум-модуль",
    items: [
      {
        slug: "compliance_pro",
        name: "Risk & Compliance Pro · Совет Старейшин",
        description:
          "Мульти-агентный AI-консилиум для оценки рисков, проверок VÖEN и сценариев compliance до того, как проблема станет штрафом.",
        highlights: ["Совет Старейшин", "ERM-панель", "Журнал RiskAudit"],
      },
      {
        slug: "tax_pro",
        name: "Tax Pro · e-Taxes RPA",
        description:
          "Автоматизация портала e-taxes через ERA Finance Assistant: меньше ручного копирования, быстрее сдача отчётности.",
        highlights: ["RPA для e-taxes", "Сценарии DVX", "Расширение браузера"],
      },
      {
        slug: "trade_pro",
        name: "Trade Pro · таможня BGD",
        description:
          "Захват и обработка деклараций BGD с e-customs, связка с закупками и внешнеторговым контуром.",
        highlights: ["Импорт BGD", "Портал e-customs", "ВЭД и склад"],
      },
    ],
  },
  mocks: {
    finance: {
      panelTitle: "Банковская выписка · сверка",
      colDate: "Дата",
      colDescription: "Назначение",
      colAmount: "Сумма",
      colStatus: "Статус",
      matched: "Сверено",
      pending: "В обработке",
      rows: [
        {
          date: "12.05.2026",
          description: "Оплата поставщику · INV-2041",
          amount: "−4 820,00",
          status: "matched",
        },
        {
          date: "11.05.2026",
          description: "Поступление от клиента · SO-118",
          amount: "+12 400,00",
          status: "matched",
        },
        {
          date: "10.05.2026",
          description: "Комиссия банка",
          amount: "−18,50",
          status: "pending",
        },
      ],
    },
    manufacturing: {
      panelTitle: "Производственный заказ",
      orderId: "MO-2026-0142",
      statusLabel: "В работе",
      progress: "68% · этап «Сборка»",
      accountFlow: "201 Материалы → 203 НЗП → 204 готовая продукция",
    },
    tax: {
      panelTitle: "Монитор лимита оборота",
      ytdLabel: "Оборот с начала года",
      limitLabel: "Порог принудительного НДС",
      warning: "Внимание: до лимита осталось менее 15%",
      amount: "152 400 AZN",
      limit: "160 000 AZN",
    },
  },
};

const landingMarketingAz: LandingMarketingCopy = {
  chrome: {
    login: "Daxil ol",
    navSatellites: "Peyklər",
  },
  footer: "ERA 365 — Azərbaycanda uçot və sənaye peykləri platforması",
  hero: {
    title: "Uçot və sənaye peykləri — bir platforma",
    subtitle:
      "ERA Core, otel, klinika, kassa və Data HUB. Palitra 19 / 29 / 39 / 99 AZN. 3 ay trial, kart tələb olunmur.",
    ctaPrimary: "3 ay tam pulsuz başla",
    ctaSecondary: "Tam kataloq",
    ctaMicrocopy: "Kredit kartı tələb olunmur • İstənilən vaxt ləğv et",
    navPricing: "Tariflər",
  },
  hub: {
    coreTitle: "ERA Core",
    coreBody: "NAS/MMUS uçotu: kitab, kassa, anbar, istehsalat, ƏV, kadrlar. Foundation 29 AZN.",
    coreCta: "Finance nüvəsi",
    satellitesTitle: "Sənaye peykləri",
    satellitesIntro: "Gate — iş yeri və baza tutumu. Nüvə və paketlər peyk səhifəsində və kataloqdadır.",
    dataHubTitle: "Data HUB",
    dataHubBody: "Soraqçalar və mübadilə. Bronze / Silver / Gold — yalnız bir tarif.",
    dataHubCta: "Data HUB",
    addonsTitle: "Platforma add-on",
    addonsBody: "Bildiriş, yaddaş, loyallıq, çatdırılma, Workforce 2/4 AZN. XOR kataloq rəfindədir.",
    addonsCta: "Add-on kataloqu",
    catalogCta: "Abunəni yığ",
  },
  trial: {
    cornerBadge: "Start üçün xüsusi təklif",
    offerPrimary: "İlk 3 ay — 0 AZN",
    offerSubline: "Foundation və sənaye Gate trial-dadır",
    checklistTitle: "Trial paketdə aktivləşdirilib",
    checklist: [
      "NAS / MMUS və IFRS / MHBS — ikiqat yazılış",
      "Kassa, anbar, istehsalat, ƏV və kadrlar",
      "Peyklər: Hotel, Clinic, F&B, Retail… (Gate)",
      "NAS-da 1000 sənəd/ay; 50 OCR səhifə",
    ],
    disclaimer:
      "*Finance premium (tax_pro, trade_pro, compliance_pro) və production CBS trial list price-ə daxil deyil.",
  },
  ecosystem: landingEcosystemAz,
  zeroKnowledge: {
    title: "Zero-Knowledge səviyyəsində mütləq məxfilik",
    claims: [
      {
        title: "Lokal şifrələnmə",
        detail:
          "Məlumatlar şəbəkəyə çıxmazdan əvvəl brauzerdə şifrələnir — açıq mətn cihazınızı tərk etmir.",
      },
      {
        title: "Sıfır giriş",
        detail:
          "ERA işçiləri texniki olaraq sizin məlumatlarınıza baxa bilməz: nə uçot, nə peyklər.",
      },
      {
        title: "Dövlət təhlükəsizlik lövbəri",
        detail:
          "Bərpa açarları kripto-eskroudadır — yalnız ASAN İmza / SİMA ilə açılır.",
      },
    ],
    identityEyebrow: "Dövlət identikliyi",
    encryptionNote: "Ucdan-uca şifrələmə · açarlar brauzerdə",
    badges: ["ASAN İmza", "SİMA"],
  },
  legacyCompare: {
    title: "ERA Finance vs köhnə 1C platformaları",
    subtitle:
      "Səkkiz head-to-head raund: niyə bulud konturu yerli «qutu» həllindən üstündür.",
    legacyBrand: "Köhnə məktəb (1C)",
    eraBrand: "ERA Finance",
    rows: [
      {
        topic: "Əlçatanlıq",
        legacy: "Yavaş yerli serverlər və VPN — giriş əsasən ofisdən",
        era: "İstənilən nöqtədən ani bulud veb və mobil giriş 24/7",
      },
      {
        topic: "Vergi uyğunluğu",
        legacy: "Hər qanun dəyişikliyində ödənişli əl ilə proqramçı müdaxiləsi",
        era: "AR qanunvericiliyinə uyğun pulsuz ani avtomatik yeniləmələr",
      },
      {
        topic: "Dövlət portalları",
        legacy: "Kabinetlər və uçot arasında XML-in əl ilə köçürülməsi",
        era: "Brauzer genişləndirməsi: e-taxes və e-customs avtomatlaşdırması",
      },
      {
        topic: "Kadrlar və ƏMAS",
        legacy:
          "Ştat cədvəlinin mexaniki yüklənməsi, ƏMAS portalında əmək müqavilələrinin təkrarlanan əl ilə daxil edilməsi",
        era: "Dövlət ƏMAS portalı ilə kadr uçotunun tam avtomatlaşdırılmış sinxronizasiyası. Müqavilələrin birbaşa ERP-dən 1 kliklə qeydiyyatı",
      },
      {
        topic: "WhatsApp",
        legacy: "Sənəd göndərmək üçün bahalı xarici plaginləri",
        era: "Kontragentə hesab və aktı WhatsApp-da 1 kliklə göndərmə",
      },
      {
        topic: "GAAP standartları",
        legacy: "NSU və MHBS ayrı silolarda — ikiqat daxiletmə",
        era: "Bir konturdə paralel NSU/MMUS və MHBS/IFRS",
      },
      {
        topic: "Sənəd daxiletmə",
        legacy: "Kağız qaimələr üzrə saatlarla əl ilə daxiletmə",
        era: "Neuro-OCR: 5 saniyədə tanıma və əvvəlcədən doldurma",
      },
      {
        topic: "ƏDV təhlükəsizliyi",
        legacy: "İnsan faktoru və dövriyyə həddinin qaçırılması",
        era: "Gündəlik AI Ağsaqqallar Şurası və 200 000 AZN mühafizəsi",
      },
    ],
  },
  bottomCta: {
    headline: "Biznesinizi kosmik sürətə keçirməyə hazırsınız?",
    subtext: "Bu gün qeydiyyatdan keçin və heç bir öhdəlik olmadan 3 aylıq tam giriş əldə edin",
    primary: "3 ay tam pulsuz başla",
    secondary: "Daxil ol",
    ctaMicrocopy: "Kredit kartı tələb olunmur • İstənilən vaxt ləğv et",
  },
  faq: {
    title: "Tez-tez verilən suallar",
    items: [
      {
        id: "what",
        question: "ERA 365 nədir?",
        answer:
          "Azərbaycan üçün uçot (ERA Core) və sənaye peykləri platforması: otel, klinika, kassa, logistika və digər iş yerləri MDM və abunə ilə eyni konturdə.",
      },
      {
        id: "pricing",
        question: "Qiymətlər necə qurulub?",
        answer:
          "SKU palitrası 19 / 29 / 39 / 99 AZN. Foundation 29. Gate peyki və baza tutumunu açır. Sənəd, OCR, SMS və yaddaş metrlərdir. Tam konstruktor tarif səhifəsindədir.",
      },
      {
        id: "xor",
        question: "Hansı modulları eyni anda açmaq olmaz?",
        answer: "Hər qrupda yalnız bir SKU seçilir.",
        chips: [
          "Data HUB Bronze / Silver / Gold",
          "Workforce Base / PRO",
          "Loyalty XOR Retail promo",
          "Delivery XOR F&B hub",
          "Hotel XOR Clinic sanatorium",
        ],
      },
      {
        id: "trial",
        question: "3 aylıq trial-a nə daxildir?",
        answer:
          "Foundation və sənaye Gate — kart olmadan 0 AZN. Finance premium və production CBS trial list-də yoxdur. 50 OCR və 1000 sənəd/ay limitindən artıq metr tutula bilər.",
      },
      {
        id: "register",
        question: "Harada qeydiyyatdan keçmək olar?",
        answer:
          "app.era-365.online: hesab, VÖEN və modullar. Daxil olduqdan sonra peyklər launcher-dən açılır. /industry səhifələri yalnız avtorizasiya olunmuşlar üçündür.",
      },
    ],
  },
  features: {
    finance: {
      eyebrow: "Maliyyə nüvəsi",
      title: "Kassa, bank və uzlaşma fasiləsiz",
      body: "KMO/KSO, çıxarışlar və avtomatik ödəniş uyğunlaşdırması — NAS keçidləri ilə vahid pul axını jurnalı.",
      bullets: [
        "Kassa jurnalı və bank kartları bir konturdə",
        "Çıxarışın hesablar və kontragentlərlə uzlaşdırılması",
        "101* və 221–224 qalıqlarının real vaxt nəzarəti",
      ],
    },
    manufacturing: {
      eyebrow: "İstehsalat Pro",
      title: "Natamam istehsalatın nəzarəti",
      body: "Şəffaf WIP: materialın 201 hesabına silinməsindən 203-də xərclərin toplanmasına və hazır məhsul buraxılışına qədər.",
      bullets: [
        "BOM və mərhələli istehsalat sifarişləri",
        "201 → 203 → 204 hesablarında «qara dəlik» yoxdur",
        "Anbar və partiya buraxılışı inteqrasiyası",
      ],
    },
    tax: {
      eyebrow: "Vergi qalxanı",
      title: "Məcburi ƏDV-dən qorunma",
      body: "YTD dövriyyənin 160k / 190k / 200k AZN həddlərinə qarşı monitorinqi — məcburi ƏDV qeydiyyatına qədər xəbərdarlıq.",
      bullets: [
        "Təşkilat üzrə gündəlik limit yenidən hesablanması",
        "Həddə yaxınlaşanda RiskAudit və bildirişlər",
        "Sahibkar və mühasib üçün şəffaf panel",
      ],
    },
  },
  premium: {
    title: "Etibarlı inkişaf üçün premium genişləndirmələr",
    subtitle:
      "AI və RPA ilə qabaqcıl plug-in modullar — biznes compliance və dövlət portallarını avtomatlaşdırmağa hazır olanda əməliyyat nüvəsinin üzərində qoşulur.",
    plugInBadge: "Premium əlavə-modul",
    items: [
      {
        slug: "compliance_pro",
        name: "Risk & Compliance Pro · Ağsaqqallar Şurası",
        description:
          "Risklərin, VÖEN yoxlamalarının və uyğunluq ssenarilərinin cəriməyə çevrilməzdən əvvəl qiymətləndirilməsi üçün çoxagentli AI konsilium.",
        highlights: ["Ağsaqqallar Şurası", "ERM paneli", "RiskAudit jurnalı"],
      },
      {
        slug: "tax_pro",
        name: "Tax Pro · e-Taxes RPA",
        description:
          "ERA Finance Assistant ilə e-taxes portalının avtomatlaşdırılması: daha az əl ilə köçürmə, daha sürətli hesabat təqdimatı.",
        highlights: ["e-taxes üçün RPA", "DVX ssenariləri", "Brauzer genişləndirməsi"],
      },
      {
        slug: "trade_pro",
        name: "Trade Pro · gömrük BGD",
        description:
          "e-customs-dan BGD bəyannamələrinin tutulması və emalı, alışlar və xarici ticarət konturu ilə əlaqə.",
        highlights: ["BGD idxalı", "e-customs portalı", "XTT və anbar"],
      },
    ],
  },
  mocks: {
    finance: {
      panelTitle: "Bank çıxarışı · uzlaşma",
      colDate: "Tarix",
      colDescription: "Təyinat",
      colAmount: "Məbləğ",
      colStatus: "Status",
      matched: "Uyğunlaşdırılıb",
      pending: "İşlənir",
      rows: [
        {
          date: "12.05.2026",
          description: "Təchizatçı ödənişi · INV-2041",
          amount: "−4 820,00",
          status: "matched",
        },
        {
          date: "11.05.2026",
          description: "Müştəri mədaxili · SO-118",
          amount: "+12 400,00",
          status: "matched",
        },
        {
          date: "10.05.2026",
          description: "Bank komissiyası",
          amount: "−18,50",
          status: "pending",
        },
      ],
    },
    manufacturing: {
      panelTitle: "İstehsalat sifarişi",
      orderId: "MO-2026-0142",
      statusLabel: "İcradadır",
      progress: "68% · «Yığım» mərhələsi",
      accountFlow: "201 Materiallar → 203 NAT → 204 hazır məhsul",
    },
    tax: {
      panelTitle: "Dövriyyə limiti monitoru",
      ytdLabel: "İldən başlayan dövriyyə",
      limitLabel: "Məcburi ƏDV həddi",
      warning: "Diqqət: həddə 15%-dən az qalıb",
      amount: "152 400 AZN",
      limit: "160 000 AZN",
    },
  },
};

export const landingMarketingCopyByLocale = {
  az: landingMarketingAz,
  ru: landingMarketingRu,
} as const satisfies Record<"az" | "ru", LandingMarketingCopy>;

function toFlatLandingCopy(m: LandingMarketingCopy): LandingPageCopy {
  return {
    heroTitle: m.hero.title,
    heroSubtitle: m.hero.subtitle,
    disclaimer: m.trial.disclaimer,
    ctaRegister: m.hero.ctaPrimary,
    ctaPricing: m.hero.ctaSecondary,
    navPricing: m.hero.navPricing,
  };
}

export const landingPageCopyByLocale = {
  ru: toFlatLandingCopy(landingMarketingRu),
  az: toFlatLandingCopy(landingMarketingAz),
} as const satisfies Record<"ru" | "az", LandingPageCopy>;

export function getLandingPageCopy(locale: "ru" | "az"): LandingPageCopy {
  return landingPageCopyByLocale[locale];
}

/** Static branches so Next/webpack retain full copy trees (dynamic `[locale]` was tree-shaken in dev). */
export function getLandingMarketingCopy(locale: Locale): LandingMarketingCopy {
  if (locale === "ru") return landingMarketingCopyByLocale.ru;
  return landingMarketingCopyByLocale.az;
}
