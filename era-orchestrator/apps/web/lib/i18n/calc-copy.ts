import type { Locale } from "@era/i18n-common";
import type { QuoteWarningId } from "../pricing/quote-calculator";

export type CalcCopy = {
  nav: string;
  title: string;
  subtitle: string;
  presets: string;
  preset: Record<"core" | "hotel_city" | "hotel_resort" | "sanatorium" | "clinic" | "kafe" | "retail", string>;
  reset: string;
  coreTitle: string;
  coreIntro: string;
  foundation: string;
  foundationHint: string;
  kafeWaiver: string;
  kafeWaiverHint: string;
  modules: string;
  bundles: string;
  bundleNone: string;
  includedInBundle: string;
  premium: string;
  satellitesTitle: string;
  satellitesIntro: string;
  gate: string;
  capacity: string;
  capacityIncluded: string;
  clinicRooms: string;
  clinicRoomsHint: string;
  clinicBeds: string;
  clinicBedsHint: string;
  addonsTitle: string;
  addonsIntro: string;
  dataHub: string;
  domain: string;
  none: string;
  workforce: string;
  workforceHint: string;
  workforceEssential: string;
  workforcePro: string;
  workforcePremium: string;
  headcount: string;
  oneShot: string;
  oneShotHint: string;
  usageTitle: string;
  usageIntro: string;
  erpLogins: string;
  erpHint: string;
  legalEntities: string;
  documents: string;
  ocr: string;
  storage: string;
  whatsapp: string;
  sms: string;
  acquiring: string;
  tradeBuyers: string;
  tradeEnrich: string;
  quoteTitle: string;
  subscription: string;
  capacityGroup: string;
  people: string;
  usage: string;
  once: string;
  recurring: string;
  usageEstimate: string;
  monthlyTotal: string;
  yearlyTotal: string;
  yearlyToggle: string;
  perMonth: string;
  trialNote: string;
  bakuNote: string;
  share: string;
  copied: string;
  register: string;
  catalog: string;
  unavailable: string;
  empty: string;
  listPrice: string;
  warnings: Record<QuoteWarningId, string>;
  line: {
    foundation: string;
    capacity: string;
    clinicRooms: string;
    clinicBeds: string;
    workforce: string;
    erp: string;
    legal: string;
    documents: string;
    ocr: string;
    storage: string;
    whatsapp: string;
    sms: string;
    acquiring: string;
    tradeBuyers: string;
    tradeEnrich: string;
  };
};

const ru: CalcCopy = {
  nav: "Калькулятор",
  title: "Калькулятор подписки",
  subtitle:
    "Соберите ERA Core, спутники, модули и квоты. Сумма считается по тем же правилам, что каталог: пакеты, XOR, ёмкость и метры.",
  presets: "Сценарии",
  preset: {
    core: "Только учёт",
    hotel_city: "Отель City",
    hotel_resort: "Отель Resort",
    sanatorium: "Санаторий",
    clinic: "Клиника",
    kafe: "ERA Kafe",
    retail: "Магазин",
  },
  reset: "Сбросить",
  coreTitle: "ERA Core",
  coreIntro: "Foundation — базовый учёт. Пакет заменяет сумму входящих модулей со скидкой и не дублирует их.",
  foundation: "ERA Core (Foundation)",
  foundationHint: "NAS / MMUS, 1 ERP-логин, 1000 документов и 50 страниц OCR в месяц.",
  kafeWaiver: "ERA Kafe без NAS",
  kafeWaiverHint: "Foundation не входит, пока не включён учёт. Gate кафе считается отдельно.",
  modules: "Модули ядра",
  bundles: "Пакет ядра",
  bundleNone: "Без пакета",
  includedInBundle: "В пакете",
  premium: "Premium",
  satellitesTitle: "Спутники",
  satellitesIntro: "Gate открывает приложение и включённую ёмкость. Модули сверх пакета добавляются отдельно.",
  gate: "Gate",
  capacity: "Ёмкость",
  capacityIncluded: "в Gate включено",
  clinicRooms: "Кабинеты",
  clinicRoomsHint: "5 в EMR или санатории, дальше 19 AZN. Один пересчёт на организацию: санаторий важнее EMR.",
  clinicBeds: "Койки",
  clinicBedsHint: "5 в стационаре, дальше 19 AZN. Считаются только вместе с модулем стационара.",
  addonsTitle: "Платформа",
  addonsIntro: "Data HUB, домен и Workforce — по одному варианту. Разовый выезд не входит в месяц.",
  dataHub: "Data HUB",
  domain: "White-label",
  none: "Нет",
  workforce: "Workforce",
  workforceHint: "Пакет 0 AZN. Оплата за каждого активного сотрудника: 2 / 4 / 6 AZN.",
  workforceEssential: "Essential · 2 AZN",
  workforcePro: "Professional · 4 AZN",
  workforcePremium: "Premium · 6 AZN",
  headcount: "Сотрудники",
  oneShot: "Разово",
  oneShotHint: "Не входит в ежемесячную сумму.",
  usageTitle: "Квоты и расход",
  usageIntro: "Подписка — фикс. Ниже оценка постоплаты за месяц. Эквайринг — 1,5% от оборота, SMS — только платформа (оператор отдельно).",
  erpLogins: "ERP-логины",
  erpHint: "1 логин входит в оплаченный Foundation. Без Foundation каждый логин — 2 AZN.",
  legalEntities: "Юрлица (VÖEN)",
  documents: "Документы в месяц",
  ocr: "Страницы OCR",
  storage: "Хранение, GB",
  whatsapp: "Сообщения WhatsApp",
  sms: "SMS",
  acquiring: "Оборот эквайринга, AZN",
  tradeBuyers: "Покупатели trade credit",
  tradeEnrich: "Обогащения trade credit",
  quoteTitle: "Смета в месяц",
  subscription: "Подписка",
  capacityGroup: "Ёмкость сверх лимита",
  people: "Люди и юрлица",
  usage: "Оценка расхода",
  once: "Разовый платёж",
  recurring: "Подписка",
  usageEstimate: "Расход (оценка)",
  monthlyTotal: "Итого в месяц",
  yearlyTotal: "Подписка за год",
  yearlyToggle: "Оплата за год",
  perMonth: "AZN / мес",
  trialNote: "Новая организация: 3 месяца trial, 0 AZN. Смета — цена после trial.",
  bakuNote: "Лимиты и закрытие периода — 1-го числа по времени Баку (Asia/Baku).",
  share: "Скопировать ссылку",
  copied: "Ссылка скопирована",
  register: "Начать 3 месяца бесплатно",
  catalog: "Полный каталог",
  unavailable: "Живой каталог временно недоступен. Смета появится, когда откроется список SKU.",
  empty: "Включите Foundation, спутник или модуль — сумма обновится здесь.",
  listPrice: "без скидки",
  warnings: {
    banking_sandbox: "Bank CBS в смете — Sandbox / Pilot. Промышленный контур (AzeriCard / AZIPS) — отдельный Custom Quote, setup от 25 000 AZN.",
    storage_sku: "Гигабайты не считаются, пока не включён Cloud Storage.",
    whatsapp_sku: "WhatsApp считается как расход. Для отправки нужен Notifications Pack.",
    sms_sku: "В смете только 0,01 AZN платформы за SMS. Нужен Notifications Pack, оператор оплачивается отдельно.",
    trade_buyers_sku: "Покупатели trade credit считаются после модуля Trade Credit Control.",
    trade_enrich_sku: "Обогащения считаются после модуля Trade Credit Factor Lead.",
    workforce_headcount: "Пакет Workforce включён. Укажите численность — иначе строка 0 AZN.",
    clinic_rooms_module: "Кабинеты сверх 5 считаются на EMR или санаторной карте. Включите один из этих модулей.",
    clinic_beds_module: "Койки сверх 5 считаются только с модулем стационара.",
    catalog_unavailable: "Каталог SKU не загрузился.",
  },
  line: {
    foundation: "ERA Core (Foundation)",
    capacity: "Сверх Gate",
    clinicRooms: "Кабинеты сверх лимита",
    clinicBeds: "Койки сверх лимита",
    workforce: "Workforce",
    erp: "Доп. ERP-логины",
    legal: "Доп. юрлица",
    documents: "Документы сверх лимита",
    ocr: "OCR сверх лимита",
    storage: "Хранение сверх 20 GB",
    whatsapp: "WhatsApp",
    sms: "SMS (платформа)",
    acquiring: "Эквайринг 1,5%",
    tradeBuyers: "Trade credit, покупатели",
    tradeEnrich: "Trade credit, обогащение",
  },
};

const az: CalcCopy = {
  nav: "Kalkulyator",
  title: "Abunə kalkulyatoru",
  subtitle:
    "ERA Core, peyklər, modullar və kvotaları yığın. Məbləğ kataloqla eyni qaydadır: paketlər, XOR, tutum və metrlər.",
  presets: "Ssenarilər",
  preset: {
    core: "Yalnız uçot",
    hotel_city: "Otel City",
    hotel_resort: "Otel Resort",
    sanatorium: "Sanatoriya",
    clinic: "Klinika",
    kafe: "ERA Kafe",
    retail: "Mağaza",
  },
  reset: "Sıfırla",
  coreTitle: "ERA Core",
  coreIntro: "Foundation əsas uçotdur. Paket daxil modulların cəmini endirimlə əvəz edir və onları təkrar saymır.",
  foundation: "ERA Core (Foundation)",
  foundationHint: "NAS / MMUS, 1 ERP login, ayda 1000 sənəd və 50 OCR səhifəsi.",
  kafeWaiver: "ERA Kafe, NAS-sız",
  kafeWaiverHint: "Uçot açılana qədər Foundation düşmür. Kafe Gate ayrı sayılır.",
  modules: "Nüvə modulları",
  bundles: "Nüvə paketi",
  bundleNone: "Paketsiz",
  includedInBundle: "Paketdə",
  premium: "Premium",
  satellitesTitle: "Peyklər",
  satellitesIntro: "Gate tətbiqi və daxil tutumu açır. Paketdən kənar modullar ayrıca əlavə olunur.",
  gate: "Gate",
  capacity: "Tutum",
  capacityIncluded: "Gate-də daxildir",
  clinicRooms: "Kabinetlər",
  clinicRoomsHint: "EMR və ya sanatoriyada 5, sonra 19 AZN. Bir təşkilatda bir sayım: sanatoriya EMR-dən üstündür.",
  clinicBeds: "Çarpayılar",
  clinicBedsHint: "Stasionarda 5, sonra 19 AZN. Yalnız stasionar modulu ilə sayılır.",
  addonsTitle: "Platforma",
  addonsIntro: "Data HUB, domen və Workforce — bir variant. Yerində vizit aya daxil deyil.",
  dataHub: "Data HUB",
  domain: "White-label",
  none: "Yox",
  workforce: "Workforce",
  workforceHint: "Paket 0 AZN. Hər aktiv əməkdaş: 2 / 4 / 6 AZN.",
  workforceEssential: "Essential · 2 AZN",
  workforcePro: "Professional · 4 AZN",
  workforcePremium: "Premium · 6 AZN",
  headcount: "Əməkdaşlar",
  oneShot: "Bir dəfəlik",
  oneShotHint: "Aylıq məbləğə daxil deyil.",
  usageTitle: "Kvotalar və sərf",
  usageIntro: "Abunə sabitdir. Aşağıdakı ayın post-ödəniş təxminidir. Ekvarinq dövriyyənin 1,5%-i, SMS yalnız platformadır (operator ayrı).",
  erpLogins: "ERP login",
  erpHint: "1 login ödənilmiş Foundation-dadır. Foundation olmayanda hər login 2 AZN-dir.",
  legalEntities: "Hüquqi şəxs (VÖEN)",
  documents: "Ayda sənəd",
  ocr: "OCR səhifə",
  storage: "Yaddaş, GB",
  whatsapp: "WhatsApp mesaj",
  sms: "SMS",
  acquiring: "Ekvarinq dövriyyəsi, AZN",
  tradeBuyers: "Trade credit alıcıları",
  tradeEnrich: "Trade credit zənginləşmə",
  quoteTitle: "Aylıq smeta",
  subscription: "Abunə",
  capacityGroup: "Limitdən artıq tutum",
  people: "İnsanlar və VÖEN",
  usage: "Sərf təxmini",
  once: "Bir dəfəlik ödəniş",
  recurring: "Abunə",
  usageEstimate: "Sərf (təxmini)",
  monthlyTotal: "Ayda cəmi",
  yearlyTotal: "İllik abunə",
  yearlyToggle: "İllik ödəniş",
  perMonth: "AZN / ay",
  trialNote: "Yeni təşkilat: 3 ay trial, 0 AZN. Smeta trial-dan sonrakı qiymətdir.",
  bakuNote: "Limitlər və dövr bağlanması ayın 1-də Bakı vaxtı (Asia/Baku) ilədir.",
  share: "Keçidi kopyala",
  copied: "Keçid kopyalandı",
  register: "3 ay pulsuz başla",
  catalog: "Tam kataloq",
  unavailable: "Canlı kataloq müvəqqəti əlçatan deyil. SKU siyahısı açılan kimi smeta görünəcək.",
  empty: "Foundation, peyk və ya modul seçin — məbləğ burada yenilənəcək.",
  listPrice: "endirimsiz",
  warnings: {
    banking_sandbox: "Bank CBS smetada Sandbox / Pilot-dur. İstehsal konturu (AzeriCard / AZIPS) ayrıca Custom Quote-dur, setup 25 000 AZN-dən.",
    storage_sku: "Gigabaytlar Cloud Storage açılmayınca sayılmır.",
    whatsapp_sku: "WhatsApp sərf kimi sayılır. Göndərmək üçün Notifications Pack lazımdır.",
    sms_sku: "Smetada SMS üçün yalnız platformanın 0,01 AZN-i var. Notifications Pack lazımdır, operator ayrıdır.",
    trade_buyers_sku: "Trade credit alıcıları Trade Credit Control modulundan sonra sayılır.",
    trade_enrich_sku: "Zənginləşmə Trade Credit Factor Lead modulundan sonra sayılır.",
    workforce_headcount: "Workforce paketi aktivdir. Sayı yazın — yoxsa sətir 0 AZN qalır.",
    clinic_rooms_module: "5-dən artıq kabinet EMR və ya sanatoriya xəritəsində sayılır. Bu modullardan birini açın.",
    clinic_beds_module: "5-dən artıq çarpayı yalnız stasionar modulu ilə sayılır.",
    catalog_unavailable: "SKU kataloqu yüklənmədi.",
  },
  line: {
    foundation: "ERA Core (Foundation)",
    capacity: "Gate-dən artıq",
    clinicRooms: "Limitdən artıq kabinet",
    clinicBeds: "Limitdən artıq çarpayı",
    workforce: "Workforce",
    erp: "Əlavə ERP login",
    legal: "Əlavə hüquqi şəxs",
    documents: "Limitdən artıq sənəd",
    ocr: "Limitdən artıq OCR",
    storage: "20 GB-dan artıq yaddaş",
    whatsapp: "WhatsApp",
    sms: "SMS (platforma)",
    acquiring: "Ekvarinq 1,5%",
    tradeBuyers: "Trade credit, alıcılar",
    tradeEnrich: "Trade credit, zənginləşmə",
  },
};

const en: CalcCopy = {
  nav: "Calculator",
  title: "Subscription calculator",
  subtitle:
    "Assemble ERA Core, satellites, modules, and quotas. The total uses the same rules as the catalog: bundles, XOR, capacity, and meters.",
  presets: "Scenarios",
  preset: {
    core: "Accounting only",
    hotel_city: "Hotel City",
    hotel_resort: "Hotel Resort",
    sanatorium: "Sanatorium",
    clinic: "Clinic",
    kafe: "ERA Kafe",
    retail: "Shop",
  },
  reset: "Reset",
  coreTitle: "ERA Core",
  coreIntro: "Foundation is the base ledger. A bundle replaces the sum of its modules at a discount and does not bill them twice.",
  foundation: "ERA Core (Foundation)",
  foundationHint: "NAS / MMUS, 1 ERP login, 1,000 documents and 50 OCR pages a month.",
  kafeWaiver: "ERA Kafe without NAS",
  kafeWaiverHint: "Foundation stays off until accounting is on. The café gate is billed on its own.",
  modules: "Core modules",
  bundles: "Core bundle",
  bundleNone: "No bundle",
  includedInBundle: "In the bundle",
  premium: "Premium",
  satellitesTitle: "Satellites",
  satellitesIntro: "The gate opens the app and the included capacity. Modules outside a bundle are added on their own.",
  gate: "Gate",
  capacity: "Capacity",
  capacityIncluded: "included in the gate",
  clinicRooms: "Cabinets",
  clinicRoomsHint: "5 on EMR or the sanatorium chart, then 19 AZN. One census per organization — sanatorium wins over EMR.",
  clinicBeds: "Beds",
  clinicBedsHint: "5 on inpatient, then 19 AZN. Billed only with the inpatient module.",
  addonsTitle: "Platform",
  addonsIntro: "Data HUB, domain, and Workforce are one choice each. An on-site visit is not part of the monthly total.",
  dataHub: "Data HUB",
  domain: "White-label",
  none: "None",
  workforce: "Workforce",
  workforceHint: "The package is 0 AZN. Each active person is 2 / 4 / 6 AZN.",
  workforceEssential: "Essential · 2 AZN",
  workforcePro: "Professional · 4 AZN",
  workforcePremium: "Premium · 6 AZN",
  headcount: "People",
  oneShot: "One-time",
  oneShotHint: "Not included in the monthly total.",
  usageTitle: "Quotas and usage",
  usageIntro: "The subscription is fixed. Below is a monthly post-paid estimate. Acquiring is 1.5% of turnover. SMS is the platform fee only (the operator is separate).",
  erpLogins: "ERP logins",
  erpHint: "1 login is included while Foundation is billed. Without Foundation each login is 2 AZN.",
  legalEntities: "Legal entities (VÖEN)",
  documents: "Documents per month",
  ocr: "OCR pages",
  storage: "Storage, GB",
  whatsapp: "WhatsApp messages",
  sms: "SMS",
  acquiring: "Acquiring turnover, AZN",
  tradeBuyers: "Trade-credit buyers",
  tradeEnrich: "Trade-credit enrichments",
  quoteTitle: "Monthly quote",
  subscription: "Subscription",
  capacityGroup: "Capacity over the included limit",
  people: "People and legal entities",
  usage: "Usage estimate",
  once: "One-time charge",
  recurring: "Subscription",
  usageEstimate: "Usage (estimate)",
  monthlyTotal: "Total per month",
  yearlyTotal: "Subscription per year",
  yearlyToggle: "Pay yearly",
  perMonth: "AZN / month",
  trialNote: "A new organization gets a 3-month trial at 0 AZN. This quote is the price after the trial.",
  bakuNote: "Limits and the billing close run on the 1st in Baku time (Asia/Baku).",
  share: "Copy link",
  copied: "Link copied",
  register: "Start 3 months free",
  catalog: "Full catalog",
  unavailable: "The live catalog is temporarily unavailable. The quote appears when the SKU list loads.",
  empty: "Turn on Foundation, a satellite, or a module — the total updates here.",
  listPrice: "list",
  warnings: {
    banking_sandbox: "Bank CBS in this quote is Sandbox / Pilot. The production contour (AzeriCard / AZIPS) is a separate custom quote, setup from 25,000 AZN.",
    storage_sku: "Gigabytes are not billed until Cloud Storage is on.",
    whatsapp_sku: "WhatsApp is estimated as usage. Sending needs the Notifications Pack.",
    sms_sku: "The quote includes only the 0.01 AZN platform fee per SMS. Notifications Pack is required; the operator is separate.",
    trade_buyers_sku: "Trade-credit buyers are billed with the Trade Credit Control module.",
    trade_enrich_sku: "Enrichments are billed with the Trade Credit Factor Lead module.",
    workforce_headcount: "A Workforce package is on. Enter headcount — otherwise that line stays 0 AZN.",
    clinic_rooms_module: "Cabinets above 5 bill on EMR or the sanatorium chart. Turn one of those modules on.",
    clinic_beds_module: "Beds above 5 bill only with the inpatient module.",
    catalog_unavailable: "The SKU catalog did not load.",
  },
  line: {
    foundation: "ERA Core (Foundation)",
    capacity: "Above the gate",
    clinicRooms: "Cabinets above the limit",
    clinicBeds: "Beds above the limit",
    workforce: "Workforce",
    erp: "Extra ERP logins",
    legal: "Extra legal entities",
    documents: "Documents above the limit",
    ocr: "OCR above the limit",
    storage: "Storage above 20 GB",
    whatsapp: "WhatsApp",
    sms: "SMS (platform)",
    acquiring: "Acquiring 1.5%",
    tradeBuyers: "Trade credit, buyers",
    tradeEnrich: "Trade credit, enrichment",
  },
};

export function getCalcCopy(locale: Locale): CalcCopy {
  if (locale === "ru") return ru;
  if (locale === "en") return en;
  return az;
}

export function calcNavLabel(locale: Locale): string {
  return getCalcCopy(locale).nav;
}
