/**
 * Localized chrome for /pricing storefront (module prices come from API).
 */

export type PricingStorefrontUiCopy = {
  heroTitle: string;
  heroSubtitle: string;
  ctaRegister: string;
  ctaLogin: string;
  coreSuiteTitle: string;
  coreSuiteIntro: string;
  foundationTitle: string;
  foundationDescription: string;
  trialPromoText: string;
  trialPromoButton: string;
  coreTrialBadge: string;
  coreTrialPriceLabel: string;
  corePostTrialTemplate: string;
  standardModulesTitle: string;
  standardModulesHint: string;
  bundlesTitle: string;
  bundlesHint: string;
  bundleCta: string;
  bundleDiscountSuffix: string;
  bundlePopularBadge: string;
  bundleSavingsLabel: string;
  pricePerMonthSuffix: string;
  matrixTitle: string;
  matrixHint: string;
  spendTierMatrixHint: string;
  matrixMetricLabel: string;
  tierSpendCeilingTemplate: string;
  tierSpendCeilingStarter: string;
  trialMeterMayBillLine: string;
  tierCurrentLabel: string;
  tierSelectLabel: string;
  tierFreeForever: string;
  tierCustom: string;
  tierPerMonth: string;
  tierTrialLine: string;
  resourceUsers: string;
  resourceInvoices: string;
  resourceDocuments: string;
  resourceStorage: string;
  resourceWhatsapp: string;
  resourceOcr: string;
  resourceWorkspaces: string;
  premiumTitle: string;
  premiumHint: string;
  premiumLockedTitle: string;
  premiumUpgradeCta: string;
  calculatorDueTodayLabel: string;
  calculatorPostpaidLabel: string;
  calculatorBakuNotice: string;
  standardModules: Record<string, { name: string; subtitle: string; bullets: string[] }>;
  premiumFeatures: Record<string, { description: string; bullets: string[] }>;
  bundles: Record<string, { name: string; moduleLine: string }>;
  hospitalityTitle: string;
  hospitalityIntro: string;
  hospitalityGateLabel: string;
  hospitalityBundleSelect: string;
  hospitalityModuleNames: Record<string, string>;
  industriesTitle: string;
  industriesIntro: string;
  industryCapacityTemplate: string;
  bankingSandboxNote: string;
  platformAddonsTitle: string;
  platformAddonsHint: string;
  platformAddonsXor: string;
  industryCopy: Record<
    string,
    { title: string; intro: string; gateLabel: string; capacityUnit?: string }
  >;
  industryModuleNames: Record<string, string>;
  platformAddonNames: Record<string, string>;
};

const uiRu: PricingStorefrontUiCopy = {
  heroTitle: "ERA: конструктор модулей 19 / 29 / 39 / 99 AZN",
  heroSubtitle:
    "Foundation 29 AZN + отраслевые спутники (Gate) и модули. Банк CBS в списке — Sandbox / Pilot; промышленный контур — Custom Quote.",
  ctaRegister: "Начать 3 месяца бесплатно",
  ctaLogin: "Войти",
  coreSuiteTitle: "ERA Core",
  coreSuiteIntro:
    "ERA Core (Foundation) — учёт NAS/MMUS. Стандартные модули — палитра 19/29/39 AZN. Счета считаются документами (пачка 1000), не отдельным метром 0.10.",
  foundationTitle: "ERA Core (Foundation)",
  foundationDescription:
    "Учёт, проводки, закрытие периода и соответствие MMUS/MHBS.",
  trialPromoText:
    "Зарегистрируйтесь сейчас и пользуйтесь всеми модулями ERA Core бесплатно в течение 3 месяцев.",
  trialPromoButton: "Начать бесплатно — 3 месяца",
  coreTrialBadge: "Первые 3 месяца бесплатно",
  coreTrialPriceLabel: "0 AZN",
  corePostTrialTemplate: "{{price}} / мес после trial (первые 3 месяца 0 AZN)",
  standardModulesTitle: "Стандартные модули ERA Core",
  standardModulesHint:
    "Входят в подписку Core или подключаются пакетами ниже — без отдельной à la carte-витрины.",
  bundlesTitle: "Готовые пакеты",
  bundlesHint:
    "Стандартные модули со скидкой — готовые наборы под типовой сценарий бизнеса.",
  bundleCta: "Активировать пакет",
  bundleDiscountSuffix: "скидка",
  bundlePopularBadge: "Популярный",
  bundleSavingsLabel: "Экономия",
  pricePerMonthSuffix: "/ мес.",
  matrixTitle: "Unit-цены и потолки расхода (spend tier)",
  matrixHint:
    "Оплата по факту использования; потолок tier — лимит накопленного расхода за месяц (Baku).",
  spendTierMatrixHint:
    "3 месяца: ERA Core (Foundation) = 0 AZN; metered-расход начисляется. При достижении потолка tier — счёт в тот же день; иначе — 1-го числа за прошлый месяц.",
  trialMeterMayBillLine:
    "Metered: документы (5 AZN / 1000 сверх лимита NAS), OCR 0.02, WhatsApp 0.05, хранение 0.50/GB. Счета входят в документы.",
  tierSpendCeilingTemplate: "до {{amount}} / мес.",
  tierSpendCeilingStarter: "старт 0 AZN",
  matrixMetricLabel: "Ресурс",
  tierCurrentLabel: "Текущий",
  tierSelectLabel: "Выбрать уровень",
  tierFreeForever: "Всегда бесплатно",
  tierCustom: "Кастомный",
  tierPerMonth: "/ месяц",
  tierTrialLine: "0 AZN / первые 3 мес.",
  resourceUsers: "ERP-логин Foundation (сверх 1 × 2 AZN)",
  resourceInvoices: "Счета (входят в документы)",
  resourceDocuments: "Документы / 1000 шт.",
  resourceStorage: "Хранилище (сверх 20 GB)",
  resourceWhatsapp: "WhatsApp / мес.",
  resourceOcr: "AI-OCR страниц / мес.",
  resourceWorkspaces: "Рабочие пространства",
  premiumTitle: "Premium-модули",
  premiumHint:
    "Расширения для налогов, таможни, compliance и внешнего аудита — подключаются поверх Core.",
  premiumLockedTitle: "Требуется коммерческий статус (TIER 1+)",
  premiumUpgradeCta: "Перейти на Tier 1+",
  calculatorDueTodayLabel:
    "Сумма к оплате сегодня (входит в 3-месячный trial): {{amount}}",
  calculatorPostpaidLabel:
    "Плата за лимиты и premium-модули (постоплата в следующем месяце): {{amount}}",
  calculatorBakuNotice:
    "Все расчеты лимитов и закрытие биллингового периода выполняются 1-го числа календарного месяца строго по времени Баку (Asia/Baku).",
  standardModules: {
    core_accounting: {
      name: "Главная бухгалтерия",
      subtitle: "Базовый учёт, проводки и закрытие периода по MMUS/MHBS",
      bullets: ["NAS / MMUS", "MHBS / IFRS", "Проводки и GL", "Закрытие периода"],
    },
    cash_bank: {
      name: "Касса и банк",
      subtitle: "Касса, POS и банк в одном платёжном контуре",
      bullets: ["Касса и POS", "Банковские выписки", "Платежи и поручения", "Сверка остатков"],
    },
    supply_sales: {
      name: "Снабжение, сбыт и склад",
      subtitle: "Закупки, продажи и складской учёт",
      bullets: ["Закупки и продажи", "FIFO и остатки", "Инвентаризация", "Себестоимость отгрузки"],
    },
    manufacturing_wip: {
      name: "Производство и НЗП",
      subtitle: "Выпуск, рецепты и учёт незавершённого производства",
      bullets: ["WIP 203", "Рецепты и спецификации", "Выпуск продукции", "Себестоимость"],
    },
    fixed_assets: {
      name: "Основные средства",
      subtitle: "Капвложения, амортизация и реестр ОС",
      bullets: ["Принятие к учёту", "Амортизация", "Перемещения и выбытие", "Реестр ОС"],
    },
    hr_payroll: {
      name: "Кадры и зарплаты",
      subtitle: "Штат, табель и расчёт зарплаты",
      bullets: ["Штатное расписание", "Табель", "Начисления", "Ведомости и выплаты"],
    },
    ifrs_mapping: {
      name: "IFRS / MHBS",
      subtitle: "Параллельный контур МСФО поверх NAS",
      bullets: ["Карта счетов IFRS", "Параллельные проводки", "Отчёты MHBS"],
    },
    consolidation_pro: {
      name: "Консолидация холдинга",
      subtitle: "Свод нескольких юрлиц",
      bullets: ["Элиминации", "Холдинговые отчёты", "Несколько VÖEN"],
    },
  },
  premiumFeatures: {
    tax_pro: {
      description: "Налоги и e-Taxes без ручного копирования.",
      bullets: [
        "Автосинхронизация e-Taxes и деклараций",
        "RPA-подача без ручного копирования",
        "Контроль лимитов НДС в реальном времени",
      ],
    },
    trade_pro: {
      description: "Таможня BGD и Trade Pro для импорта.",
      bullets: [
        "BGD / e-customs с предзаполнением",
        "HS-коды и пошлины из справочника KM",
        "Проводки себестоимости и входного НДС",
      ],
    },
    compliance_pro: {
      description: "ERM, AI Council и трудовой compliance.",
      bullets: [
        "AI Council of Elders — аудит рисков",
        "ƏMAS: трудовые договоры в 1 клик",
        "ERM-дашборд и журнал mitigation",
      ],
    },
    audit_hub: {
      description: "Рабочее место внешнего аудитора и guest-доступ.",
      bullets: [
        "Engagement, выборки и timeline",
        "NAS/IFRS отчёты для аудитора",
        "Bulk export и guest-приглашения",
      ],
    },
  },
  bundles: {
    cash_warehouse: {
      name: "Cash & warehouse",
      moduleLine: "Cash & Bank Pro + Warehouse",
    },
    hr_ifrs: {
      name: "HR & IFRS",
      moduleLine: "HR + IFRS mapping",
    },
    trade_ops: {
      name: "Trade & operations",
      moduleLine: "Warehouse + Manufacturing",
    },
    hotel_city: {
      name: "Hotel City",
      moduleLine: "Front Office, HK, Night Audit, Front Cash",
    },
    hotel_resort: {
      name: "Hotel Resort",
      moduleLine: "City + Channel, Yield, Guests, SPA, Banquets",
    },
    hotel_sanatorium: {
      name: "Hotel Sanatorium",
      moduleLine: "Resort + Medical & Sanatorium (XOR с clinic sanatorium)",
    },
    banking_retail: {
      name: "Banking Retail (Sandbox / Pilot)",
      moduleLine: "Core, deposits, loans, cards, payments, DBO, AML",
    },
    banking_universal: {
      name: "Banking Universal (Sandbox / Pilot)",
      moduleLine: "Полный CBS-набор — production = Custom Quote от 25 000 AZN",
    },
  },
  hospitalityTitle: "Hotel PMS — гостеприимство",
  hospitalityIntro:
    "Отраслевой спутник и модули hotel_* (не путать с platform add-ons).",
  hospitalityGateLabel: "Hotel PMS (доступ к приложению)",
  hospitalityBundleSelect: "Выберите пакет",
  hospitalityModuleNames: {
    industry_hotel_pms: "Hotel PMS",
    hotel_core: "PMS Core (Front Office, Front Cash, Night Audit)",
    hotel_housekeeping: "Housekeeping & Room Rack",
    hotel_migration_pro: "Migration PRO",
    hotel_distribution: "Distribution (Channel Manager & Contracts)",
    hotel_guest_experience: "Guest Profiles & Tasks",
    hotel_spa_scheduling: "SPA & Scheduling",
    hotel_transfers: "Transfers",
    hotel_banquets: "Banquets & BEO",
    hotel_medical_sanatorium: "Medical & Sanatorium",
    hotel_setup_advanced: "Advanced master data",
  },
  industriesTitle: "Отраслевые спутники",
  industriesIntro:
    "Gate 29 AZN (банк — 99) открывает приложение и 1 единицу ёмкости. Операционные ядра (hotel_core, EMR) — отдельные SKU. Hotel Sanatorium и clinic_sanatorium_clinical не совмещаются.",
  industryCapacityTemplate: "В Gate: {{included}} {{unit}}, далее {{price}} за единицу.",
  bankingSandboxNote:
    "Цены CBS — Sandbox / Pilot. Промышленный контур (AzeriCard / AZIPS) — Custom Quote, setup от 25 000 AZN.",
  platformAddonsTitle: "Платформенные add-on",
  platformAddonsHint:
    "Кросс-вертикальные сервисы оркестратора. Workforce headcount — 2 AZN Base XOR 4 AZN PRO за человека (не SKU на этой полке).",
  platformAddonsXor:
    "XOR: Data HUB Bronze / Silver / Gold · Loyalty XOR Retail promotions · Delivery XOR F&B delivery hub.",
  industryCopy: {
    industry_hotel_pms: {
      title: "Hotel PMS",
      intro: "Front office, HK, channel, SPA. Resort list 222 AZN × 15% = 188.70 AZN.",
      gateLabel: "Hotel PMS Gate (приложение + 5 номеров)",
      capacityUnit: "номер",
    },
    industry_clinic: {
      title: "Clinic",
      intro: "EMR 29, лаборатория 29, санаторная карта 29, страховка 39. Расписание и касса — в Gate.",
      gateLabel: "Clinic Gate (приложение + 1 кабинет)",
      capacityUnit: "кабинет",
    },
    industry_fnb_pos: {
      title: "F&B POS",
      intro: "Кухня KDS, PIN официанта, рецепты. XOR: platform_delivery vs fnb_delivery_hub.",
      gateLabel: "F&B Gate (1 касса)",
      capacityUnit: "касса",
    },
    industry_retail: {
      title: "Retail POS",
      intro: "Промо и omni. XOR: platform_loyalty vs retail_promotions.",
      gateLabel: "Retail Gate (1 касса)",
      capacityUnit: "касса",
    },
    industry_auto_service: {
      title: "Auto STO",
      intro: "Запчасти B2B и нормы/TecDoc.",
      gateLabel: "Auto Gate (1 пост)",
      capacityUnit: "пост",
    },
    industry_logistics: {
      title: "Logistics",
      intro: "Путевые, топливо, мобильный водитель.",
      gateLabel: "Logistics Gate (2 ТС)",
      capacityUnit: "ТС",
    },
    industry_construction: {
      title: "Construction",
      intro: "Площадки, акты, субподряд.",
      gateLabel: "Construction Gate (1 объект)",
      capacityUnit: "объект",
    },
    industry_wholesale: {
      title: "Wholesale",
      intro: "Склад дистрибуции.",
      gateLabel: "Wholesale Gate (1 склад)",
      capacityUnit: "склад",
    },
    industry_crm: {
      title: "CRM Field",
      intro: "Полевые продажи. Место CRM 5 AZN сверх 1 в Gate.",
      gateLabel: "CRM Gate (1 место)",
      capacityUnit: "место",
    },
    industry_banking: {
      title: "Bank CBS",
      intro: "Финтех-шлюз и 1 филиал в Gate 99. Не коммерческий ABS.",
      gateLabel: "Banking Gate (Sandbox / Pilot, 1 филиал)",
      capacityUnit: "филиал",
    },
  },
  industryModuleNames: {
    clinic_registry_emr: "EMR / протоколы визита",
    clinic_lab: "Лаборатория",
    clinic_sanatorium_clinical: "Санаторная клиническая карта",
    clinic_insurance: "Страхование / ДМС",
    clinic_inpatient: "Стационар / койки",
    clinic_telehealth: "Телемедицина",
    clinic_nurse_roster: "Сестринский пост / процедуры",
  },
  platformAddonNames: {
    platform_notifications: "Notifications Pack",
    platform_storage: "Cloud Storage (20 GB в SKU)",
    platform_reference_data: "Data HUB Bronze",
    platform_datahub_silver: "Data HUB Silver",
    platform_datahub_gold: "Data HUB Gold",
    platform_booking: "Online Booking",
    platform_portal: "Client Portal",
    platform_domain: "White-label domain",
    platform_loyalty: "Loyalty (XOR retail promo)",
    platform_delivery: "Delivery (XOR F&B hub)",
  },
};

const uiAz: PricingStorefrontUiCopy = {
  heroTitle: "ERA: modul konstruktoru 19 / 29 / 39 / 99 AZN",
  heroSubtitle:
    "Foundation 29 AZN + sənaye peykləri (Gate) və modullar. Bank CBS siyahıda Sandbox / Pilot-dur; istehsal konturu — Custom Quote.",
  ctaRegister: "3 ay tam pulsuz başla",
  ctaLogin: "Daxil ol",
  coreSuiteTitle: "ERA Core",
  coreSuiteIntro:
    "ERA Core (Foundation) — NAS/MMUS uçotu. Standart modullar — 19/29/39 AZN palitrası. Qaimələr sənəd paketindədir (1000), ayrıca 0.10 metrik yoxdur.",
  foundationTitle: "ERA Core (Foundation)",
  foundationDescription:
    "Uçot, yazılışlar, dövr bağlanması, MMUS/MHBS uyğunluğu.",
  trialPromoText:
    "İndi qeydiyyatdan keçin və 3 ay müddətində bütün ERA Core modullarından pulsuz istifadə edin.",
  trialPromoButton: "Pulsuz başla — 3 ay",
  coreTrialBadge: "İlk 3 ay tam pulsuz",
  coreTrialPriceLabel: "0 AZN",
  corePostTrialTemplate: "{{price}} / ay trialdan sonra (ilk 3 ay 0 AZN)",
  standardModulesTitle: "ERA Core standart modulları",
  standardModulesHint:
    "Core abunəliyə daxildir və ya aşağıdakı paketlərlə qoşulur — ayrıca modul siyahısı yoxdur.",
  bundlesTitle: "Hazır paketlər",
  bundlesHint:
    "Endirimli standart modullar — tipik biznes ssenarisi üçün hazır paketlər.",
  bundleCta: "Paketi aktivləşdir",
  bundleDiscountSuffix: "endirim",
  bundlePopularBadge: "Məşhur",
  bundleSavingsLabel: "Qənaət",
  pricePerMonthSuffix: "/ ay",
  matrixTitle: "Unit qiymətlər və xərc tavanları (spend tier)",
  matrixHint:
    "Faktiki istifadəyə görə ödəniş; tier tavanı — Bakı ayı üzrə yığılmış xərc limiti.",
  spendTierMatrixHint:
    "3 ay: ERA Core (Foundation) = 0 AZN; metered xərc hesablanır. Tavan çatanda — eyni gün faktura; əks halda — keçən ay üçün ayın 1-də.",
  trialMeterMayBillLine:
    "Metered: sənədlər (NAS limitindən sonra 5 AZN / 1000), OCR 0.02, WhatsApp 0.05, yaddaş 0.50/GB. Qaimələr sənədlərə daxildir.",
  tierSpendCeilingTemplate: "{{amount}} / ay qədər",
  tierSpendCeilingStarter: "0 AZN start",
  matrixMetricLabel: "Resurs",
  tierCurrentLabel: "Cari Tarif",
  tierSelectLabel: "Bu səviyyəni seç",
  tierFreeForever: "Həmişə pulsuz",
  tierCustom: "Fərdi",
  tierPerMonth: "/ ay",
  tierTrialLine: "0 AZN / ilk 3 ay",
  resourceUsers: "Foundation ERP login (1-dən artıq × 2 AZN)",
  resourceInvoices: "Qaimələr (sənədlərə daxildir)",
  resourceDocuments: "Sənədlər / 1000 əd.",
  resourceStorage: "Yaddaş (20 GB-dan artıq)",
  resourceWhatsapp: "WhatsApp / ay",
  resourceOcr: "AI-OCR səhifə / ay",
  resourceWorkspaces: "İş məkanları",
  premiumTitle: "Premium əlavə-modullar",
  premiumHint:
    "Vergi, gömrük, compliance və xarici audit genişləndirmələri — Core üzərində qoşulur.",
  premiumLockedTitle: "Kommersiya statusu tələb olunur (TİER 1+)",
  premiumUpgradeCta: "Tier 1+ seçin",
  calculatorDueTodayLabel:
    "Bu gün ödənilən məbləğ (3 aylıq triala daxildir): {{amount}}",
  calculatorPostpaidLabel:
    "Limitlər və premium modullar üçün ödəniş (növbəti ayda postoplat): {{amount}}",
  calculatorBakuNotice:
    "Bütün limit hesablamaları və billing dövrünün bağlanması ayın 1-də cədvəl vaxtı ilə Bakı (Asia/Baku) üzrə aparılır.",
  standardModules: {
    core_accounting: {
      name: "Əsas mühasibatlıq",
      subtitle: "MMUS/MHBS üzrə əsas uçot, yazılışlar və dövr bağlanması",
      bullets: ["NSU / MMUS", "MHBS / IFRS", "Yazılışlar və GL", "Dövr bağlanması"],
    },
    cash_bank: {
      name: "Kassa və bank",
      subtitle: "Kassa, POS və bank bir ödəniş konturunda",
      bullets: ["Kassa və POS", "Bank çıxarışları", "Ödənişlər və sərəğmələr", "Qalıqların yoxlanması"],
    },
    supply_sales: {
      name: "Təchizat, satış və anbar",
      subtitle: "Alış-satış və anbar uçotu",
      bullets: ["Alış və satış", "FIFO və qalıqlar", "İnventar", "Göndəriş maya dəyəri"],
    },
    manufacturing_wip: {
      name: "İstehsalat və NAT",
      subtitle: "Buraxılış, reseptlər və natamam istehsalat uçotu",
      bullets: ["NAT 203", "Reseptlər və spesifikasiya", "Məhsul buraxılışı", "Maya dəyəri"],
    },
    fixed_assets: {
      name: "Əsas vəsaitlər",
      subtitle: "Kapital qoyuluşlar, amortizasiya və OV reyestri",
      bullets: ["Uçota qəbul", "Amortizasiya", "Köçürmə və çıxarış", "OV reyestri"],
    },
    hr_payroll: {
      name: "Kadrlar və əməkhaqqı",
      subtitle: "Ştat, tabel və əməkhaqqı hesablanması",
      bullets: ["Ştat cədvəli", "Tabel", "Hesablamalar", "Vərəqələr və ödənişlər"],
    },
    ifrs_mapping: {
      name: "IFRS / MHBS",
      subtitle: "NAS üzərində paralel MHBS konturu",
      bullets: ["IFRS hesab planı", "Paralel yazılışlar", "MHBS hesabatları"],
    },
    consolidation_pro: {
      name: "Holdinq konsolidasiyası",
      subtitle: "Bir neçə hüquqi şəxsin svodu",
      bullets: ["Eliminasiyalar", "Holdinq hesabatları", "Bir neçə VÖEN"],
    },
  },
  premiumFeatures: {
    tax_pro: {
      description: "Vergilər və e-Taxes əl ilə köçürmə olmadan.",
      bullets: [
        "e-Taxes avtosinxron və bəyannamələr",
        "RPA ilə əl ilə kopyalama olmadan",
        "ƏDV limitləri real vaxtda",
      ],
    },
    trade_pro: {
      description: "BGD gömrük və Trade Pro import üçün.",
      bullets: [
        "BGD / e-customs ön-doldurma",
        "KM tarif kitabından HS və rüsum",
        "Maya dəyəri və giriş ƏDV yazılışları",
      ],
    },
    compliance_pro: {
      description: "ERM, AI Şura və əmək compliance.",
      bullets: [
        "AI Ağsaqqallar Şurası — risk auditi",
        "ƏMAS: əmək müqavilələri 1 kliklə",
        "ERM paneli və mitigation jurnalı",
      ],
    },
    audit_hub: {
      description: "Xarici auditor iş yeri və guest giriş.",
      bullets: [
        "Engagement, seçmə və timeline",
        "Auditor üçün NAS/IFRS hesabatları",
        "Bulk export və guest dəvətləri",
      ],
    },
  },
  bundles: {
    cash_warehouse: {
      name: "Cash & warehouse",
      moduleLine: "Cash & Bank Pro + Anbar",
    },
    hr_ifrs: {
      name: "HR & IFRS",
      moduleLine: "HR + IFRS mapping",
    },
    trade_ops: {
      name: "Trade & operations",
      moduleLine: "Anbar + İstehsalat",
    },
    hotel_city: {
      name: "Hotel City",
      moduleLine: "Front Office, HK, Night Audit, Front Cash",
    },
    hotel_resort: {
      name: "Hotel Resort",
      moduleLine: "City + Channel, Yield, Qonaqlar, SPA, Banket",
    },
    hotel_sanatorium: {
      name: "Hotel Sanatorium",
      moduleLine: "Resort + Tibbi & Sanatoriya (clinic sanatorium ilə XOR)",
    },
    banking_retail: {
      name: "Banking Retail (Sandbox / Pilot)",
      moduleLine: "Core, depozit, kredit, kart, ödəniş, DBO, AML",
    },
    banking_universal: {
      name: "Banking Universal (Sandbox / Pilot)",
      moduleLine: "Tam CBS dəsti — production Custom Quote, 25 000 AZN-dən",
    },
  },
  hospitalityTitle: "Hotel PMS — Hospitality",
  hospitalityIntro:
    "Sənaye peyk tətbiqi və hotel_* modulları (platform add-ons deyil).",
  hospitalityGateLabel: "Hotel PMS (tətbiq girişi)",
  hospitalityBundleSelect: "Paket seçin",
  hospitalityModuleNames: {
    industry_hotel_pms: "Hotel PMS",
    hotel_core: "PMS Core (Front Office, Front Cash, Night Audit)",
    hotel_housekeeping: "Housekeeping & Room Rack",
    hotel_migration_pro: "Migration PRO",
    hotel_distribution: "Distribution (Channel Manager & Contracts)",
    hotel_guest_experience: "Guest Profiles & Tasks",
    hotel_spa_scheduling: "SPA & Scheduling",
    hotel_transfers: "Transfers",
    hotel_banquets: "Banquets & BEO",
    hotel_medical_sanatorium: "Medical & Sanatorium",
    hotel_setup_advanced: "Advanced master data",
  },
  industriesTitle: "Sənaye peykləri",
  industriesIntro:
    "Gate 29 AZN (bank — 99) tətbiqi və 1 tutum vahidini açır. Əməliyyat nüvələri ayrıca SKU-dur. Hotel Sanatorium və clinic_sanatorium_clinical birlikdə olmur.",
  industryCapacityTemplate: "Gate-də: {{included}} {{unit}}, sonra vahid {{price}}.",
  bankingSandboxNote:
    "CBS qiymətləri Sandbox / Pilot-dur. İstehsal konturu (AzeriCard / AZIPS) — Custom Quote, setup 25 000 AZN-dən.",
  platformAddonsTitle: "Platforma add-on-ları",
  platformAddonsHint:
    "Orkestratorun kəsişən servisləri. Workforce headcount — şəxs başına 2 AZN Base XOR 4 AZN PRO (bu rəfdə SKU deyil).",
  platformAddonsXor:
    "XOR: Data HUB Bronze / Silver / Gold · Loyalty XOR Retail promotions · Delivery XOR F&B delivery hub.",
  industryCopy: {
    industry_hotel_pms: {
      title: "Hotel PMS",
      intro: "Front office, HK, channel, SPA. Resort siyahı 222 AZN × 15% = 188.70 AZN.",
      gateLabel: "Hotel PMS Gate (tətbiq + 5 otaq)",
      capacityUnit: "otaq",
    },
    industry_clinic: {
      title: "Clinic",
      intro: "EMR 29, laboratoriya 29, sanatoriya xəritəsi 29, sığorta 39. Cədvəl və kassa Gate-dədir.",
      gateLabel: "Clinic Gate (tətbiq + 1 kabinet)",
      capacityUnit: "kabinet",
    },
    industry_fnb_pos: {
      title: "F&B POS",
      intro: "Mətbəx KDS, ofisiant PIN, reseptlər. XOR: platform_delivery vs fnb_delivery_hub.",
      gateLabel: "F&B Gate (1 kassa)",
      capacityUnit: "kassa",
    },
    industry_retail: {
      title: "Retail POS",
      intro: "Promo və omni. XOR: platform_loyalty vs retail_promotions.",
      gateLabel: "Retail Gate (1 kassa)",
      capacityUnit: "kassa",
    },
    industry_auto_service: {
      title: "Auto STO",
      intro: "B2B ehtiyat hissələri və TecDoc normaları.",
      gateLabel: "Auto Gate (1 post)",
      capacityUnit: "post",
    },
    industry_logistics: {
      title: "Logistics",
      intro: "Yol vərəqələri, yanacaq, sürücü mobil.",
      gateLabel: "Logistics Gate (2 NQ)",
      capacityUnit: "NQ",
    },
    industry_construction: {
      title: "Construction",
      intro: "Sahələr, aktlar, subpodrat.",
      gateLabel: "Construction Gate (1 obyekt)",
      capacityUnit: "obyekt",
    },
    industry_wholesale: {
      title: "Wholesale",
      intro: "Distribusiya anbarı.",
      gateLabel: "Wholesale Gate (1 anbar)",
      capacityUnit: "anbar",
    },
    industry_crm: {
      title: "CRM Field",
      intro: "Sahə satışları. CRM yeri Gate-dən sonra 5 AZN.",
      gateLabel: "CRM Gate (1 yer)",
      capacityUnit: "yer",
    },
    industry_banking: {
      title: "Bank CBS",
      intro: "Fintech şlüz və Gate 99-da 1 filial. Kommersiya ABS deyil.",
      gateLabel: "Banking Gate (Sandbox / Pilot, 1 filial)",
      capacityUnit: "filial",
    },
  },
  industryModuleNames: {
    clinic_registry_emr: "EMR / vizit protokolları",
    clinic_lab: "Laboratoriya",
    clinic_sanatorium_clinical: "Sanatoriya klinik xəritəsi",
    clinic_insurance: "Sığorta / DMS",
    clinic_inpatient: "Stasionar / çarpayı",
    clinic_telehealth: "Telehealth",
    clinic_nurse_roster: "Tibb bacısı postu / prosedurlar",
  },
  platformAddonNames: {
    platform_notifications: "Notifications Pack",
    platform_storage: "Cloud Storage (SKU-da 20 GB)",
    platform_reference_data: "Data HUB Bronze",
    platform_datahub_silver: "Data HUB Silver",
    platform_datahub_gold: "Data HUB Gold",
    platform_booking: "Online Booking",
    platform_portal: "Client Portal",
    platform_domain: "White-label domain",
    platform_loyalty: "Loyalty (XOR retail promo)",
    platform_delivery: "Delivery (XOR F&B hub)",
  },
};

export function getPricingStorefrontUiCopy(locale: "ru" | "az"): PricingStorefrontUiCopy {
  return locale === "ru" ? uiRu : uiAz;
}
