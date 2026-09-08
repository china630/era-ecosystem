import type { Locale } from "@era/i18n-common";
import type { PublicSatelliteSlug } from "../satellites/public-satellite-catalog";

export type SatellitePageCopy = {
  kicker: string;
  title: string;
  tagline: string;
  gateTitle: string;
  gateBullets: string[];
  catalogNote: string;
  pricingCta: string;
  registerCta: string;
  xorTitle: string | null;
  xorChips: string[];
  bankNote: string | null;
};

export type SatellitesIndexCopy = {
  title: string;
  intro: string;
  coreLabel: string;
  industryLabel: string;
  platformLabel: string;
};

type SatelliteCopyPack = {
  index: SatellitesIndexCopy;
  pages: Record<PublicSatelliteSlug, SatellitePageCopy>;
};

const ru: SatelliteCopyPack = {
  index: {
    title: "Спутники ERA 365",
    intro:
      "Каждый спутник — рабочее место отрасли. Gate открывает приложение и базовую ёмкость; ядра и метры — в полном каталоге.",
    coreLabel: "Учёт",
    industryLabel: "Отрасль",
    platformLabel: "Платформа",
  },
  pages: {
    finance: {
      kicker: "ERA Core",
      title: "Finance — учёт NAS / MMUS",
      tagline:
        "Главная книга, касса, склад, производство, ОС и кадры. Foundation 29 AZN: 1 ERP-логин, 1 юрлицо, 50 стр. OCR.",
      gateTitle: "Foundation vs модули",
      gateBullets: [
        "Foundation 29 AZN — NAS/MMUS, закрытие периода, 1 логин и 1 юрлицо",
        "Касса 39 · склад 19 · производство 29 · ОС 19 · кадры/GL 29",
        "Доп. ERP-логин 2 AZN · доп. юрлицо 19 AZN",
        "Premium: Tax / Trade / Compliance — поверх Core, не в trial list",
      ],
      catalogNote: "Ориентир. Канон SKU и метров — полный каталог /pricing.",
      pricingCta: "Каталог Core",
      registerCta: "Начать 3 месяца бесплатно",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    hotel: {
      kicker: "Спутник",
      title: "Hotel PMS",
      tagline: "Front office, HK, channel, SPA. Gate открывает приложение и 5 номеров.",
      gateTitle: "Gate vs ядро",
      gateBullets: [
        "Gate 29 AZN — доступ к приложению + 5 номеров, далее 4 AZN / номер",
        "hotel_core (FO / Front Cash / Night Audit) — отдельный SKU 29",
        "HK, distribution, guests, SPA, банкеты, трансферы — модули палитры",
        "Resort-пакет: list 222 AZN × 15% = 188.70 AZN / мес",
      ],
      catalogNote: "Ориентир. Канон — /pricing#hotel.",
      pricingCta: "Цены Hotel",
      registerCta: "Начать trial",
      xorTitle: "XOR санаторий",
      xorChips: ["hotel_medical_sanatorium", "clinic_sanatorium_clinical"],
      bankNote: null,
    },
    clinic: {
      kicker: "Спутник",
      title: "Clinic",
      tagline: "Расписание, приёмы и касса в Gate. EMR, лаборатория и санаторий — отдельные SKU.",
      gateTitle: "Gate vs ядро",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 кабинет, далее 19 AZN / кабинет",
        "EMR 29 · лаборатория 29 · санаторная карта 29 · страховка 39",
        "Расписание и касса входят в Gate, не в EMR",
      ],
      catalogNote: "Ориентир. Канон — /pricing#clinic.",
      pricingCta: "Цены Clinic",
      registerCta: "Начать trial",
      xorTitle: "XOR санаторий",
      xorChips: ["hotel_medical_sanatorium", "clinic_sanatorium_clinical"],
      bankNote: null,
    },
    fnb: {
      kicker: "Спутник",
      title: "F&B POS",
      tagline: "Зал, кухня KDS и PIN официанта. Одна касса в Gate.",
      gateTitle: "Gate vs ёмкость",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 касса, далее 19 AZN / POS",
        "KDS и PIN официанта — в контуре F&B",
        "Доставка: platform_delivery XOR fnb_delivery_hub",
      ],
      catalogNote: "Ориентир. Канон — /pricing#fnb.",
      pricingCta: "Цены F&B",
      registerCta: "Начать trial",
      xorTitle: "XOR доставка",
      xorChips: ["platform_delivery", "fnb_delivery_hub"],
      bankNote: null,
    },
    retail: {
      kicker: "Спутник",
      title: "Retail POS",
      tagline: "Касса магазина и omni. Одна касса в Gate.",
      gateTitle: "Gate vs ёмкость",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 касса, далее 19 AZN",
        "Промо: platform_loyalty XOR retail_promotions",
      ],
      catalogNote: "Ориентир. Канон — /pricing#retail.",
      pricingCta: "Цены Retail",
      registerCta: "Начать trial",
      xorTitle: "XOR лояльность",
      xorChips: ["platform_loyalty", "retail_promotions"],
      bankNote: null,
    },
    auto: {
      kicker: "Спутник",
      title: "Auto STO",
      tagline: "Посты, заказ-наряды, запчасти B2B.",
      gateTitle: "Gate vs ёмкость",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 пост, далее 19 AZN / пост",
        "B2B запчасти и нормы / TecDoc — модули спутника",
      ],
      catalogNote: "Ориентир. Канон — /pricing#auto.",
      pricingCta: "Цены Auto",
      registerCta: "Начать trial",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    logistics: {
      kicker: "Спутник",
      title: "Logistics",
      tagline: "Путевые, топливо, POD водителя.",
      gateTitle: "Gate vs ёмкость",
      gateBullets: [
        "Gate 29 AZN — приложение + 2 ТС, далее 5 AZN / машина",
        "Мобильный водитель и POD — в контуре логистики",
      ],
      catalogNote: "Ориентир. Канон — /pricing#logistics.",
      pricingCta: "Цены Logistics",
      registerCta: "Начать trial",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    construction: {
      kicker: "Спутник",
      title: "Construction",
      tagline: "Площадки, сметы, акты, субподряд.",
      gateTitle: "Gate vs ёмкость",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 объект, далее 29 AZN / площадка",
        "Сметы и акты — в контуре строительства",
      ],
      catalogNote: "Ориентир. Канон — /pricing#construction.",
      pricingCta: "Цены Construction",
      registerCta: "Начать trial",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    wholesale: {
      kicker: "Спутник",
      title: "Wholesale",
      tagline: "Дистрибуция и опт на одном VÖEN.",
      gateTitle: "Gate vs ёмкость",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 склад, далее 19 AZN / склад",
        "Опт не путать с розничной кассой Retail",
      ],
      catalogNote: "Ориентир. Канон — /pricing#wholesale.",
      pricingCta: "Цены Wholesale",
      registerCta: "Начать trial",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    crm: {
      kicker: "Спутник",
      title: "CRM Field",
      tagline: "Полевые продажи. Одно место в Gate, далее 5 AZN.",
      gateTitle: "Gate vs место",
      gateBullets: [
        "Gate 29 AZN — приложение + 1 место CRM, далее 5 AZN / seat",
        "Не путать с Notifications Pack и с ERP-логином Foundation (2 AZN)",
      ],
      catalogNote: "Ориентир. Канон — /pricing#crm.",
      pricingCta: "Цены CRM",
      registerCta: "Начать trial",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    banking: {
      kicker: "Sandbox / Pilot",
      title: "Bank CBS",
      tagline: "Финтех-шлюз. Цены в каталоге — Sandbox / Pilot, не коммерческий ABS.",
      gateTitle: "Gate vs production",
      gateBullets: [
        "Gate 99 AZN — 1 филиал в списке Sandbox / Pilot",
        "banking_core 99 — не промышленный CBS",
        "Production (AzeriCard / AZIPS) — Custom Quote, setup от 25 000 AZN",
      ],
      catalogNote: "Ориентир. Канон — /pricing#banking.",
      pricingCta: "Цены Banking",
      registerCta: "Запросить пилот",
      xorTitle: null,
      xorChips: [],
      bankNote:
        "Список SKU не означает готовность продавать полный банк. Capability Inventory — OUT для trade/custody.",
    },
    "data-hub": {
      kicker: "Платформа",
      title: "Data HUB",
      tagline: "Справочники и обмен. Три тарифа — только один.",
      gateTitle: "Bronze / Silver / Gold",
      gateBullets: [
        "XOR: Bronze · Silver · Gold — одновременно один SKU",
        "Не отраслевой спутник: живёт на полке platform add-ons",
      ],
      catalogNote: "Ориентир. Канон — /pricing#addons.",
      pricingCta: "Add-on в каталоге",
      registerCta: "Начать trial",
      xorTitle: "XOR Data HUB",
      xorChips: ["Bronze", "Silver", "Gold"],
      bankNote: null,
    },
  },
};

const az: SatelliteCopyPack = {
  index: {
    title: "ERA 365 peykləri",
    intro:
      "Hər peyk — sənaye iş yeri. Gate tətbiqi və baza tutumu açır; nüvə və metrlər tam kataloqdadır.",
    coreLabel: "Uçot",
    industryLabel: "Sənaye",
    platformLabel: "Platforma",
  },
  pages: {
    finance: {
      kicker: "ERA Core",
      title: "Finance — NAS / MMUS uçotu",
      tagline:
        "Baş kitab, kassa, anbar, istehsalat, ƏV və kadrlar. Foundation 29 AZN: 1 ERP login, 1 hüquqi şəxs, 50 OCR səhifə.",
      gateTitle: "Foundation vs modullar",
      gateBullets: [
        "Foundation 29 AZN — NAS/MMUS, dövr bağlanması, 1 login və 1 hüquqi şəxs",
        "Kassa 39 · anbar 19 · istehsalat 29 · ƏV 19 · kadr/GL 29",
        "Əlavə ERP login 2 AZN · əlavə hüquqi şəxs 19 AZN",
        "Premium: Tax / Trade / Compliance — Core üzərində, trial list-də yoxdur",
      ],
      catalogNote: "Oryantir. SKU və metr kanonu — /pricing.",
      pricingCta: "Core kataloqu",
      registerCta: "3 ay pulsuz başla",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    hotel: {
      kicker: "Peyk",
      title: "Hotel PMS",
      tagline: "Front office, HK, channel, SPA. Gate tətbiqi və 5 otağı açır.",
      gateTitle: "Gate vs nüvə",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 5 otaq, sonra 4 AZN / otaq",
        "hotel_core (FO / Front Cash / Night Audit) — ayrıca SKU 29",
        "HK, distribution, qonaqlar, SPA, banket, transfer — palitra modulları",
        "Resort paket: list 222 AZN × 15% = 188.70 AZN / ay",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#hotel.",
      pricingCta: "Hotel qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: "XOR sanatoriya",
      xorChips: ["hotel_medical_sanatorium", "clinic_sanatorium_clinical"],
      bankNote: null,
    },
    clinic: {
      kicker: "Peyk",
      title: "Clinic",
      tagline: "Cədvəl, qəbul və kassa Gate-də. EMR, laboratoriya və sanatoriya — ayrıca SKU.",
      gateTitle: "Gate vs nüvə",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 kabinet, sonra 19 AZN / kabinet",
        "EMR 29 · laboratoriya 29 · sanatoriya kartı 29 · sığorta 39",
        "Cədvəl və kassa Gate-ə daxildir, EMR-ə deyil",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#clinic.",
      pricingCta: "Clinic qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: "XOR sanatoriya",
      xorChips: ["hotel_medical_sanatorium", "clinic_sanatorium_clinical"],
      bankNote: null,
    },
    fnb: {
      kicker: "Peyk",
      title: "F&B POS",
      tagline: "Zal, KDS mətbəx və ofisiant PIN. Gate-də 1 kassa.",
      gateTitle: "Gate vs tutum",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 kassa, sonra 19 AZN / POS",
        "KDS və ofisiant PIN F&B konturundadır",
        "Çatdırılma: platform_delivery XOR fnb_delivery_hub",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#fnb.",
      pricingCta: "F&B qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: "XOR çatdırılma",
      xorChips: ["platform_delivery", "fnb_delivery_hub"],
      bankNote: null,
    },
    retail: {
      kicker: "Peyk",
      title: "Retail POS",
      tagline: "Mağaza kassası və omni. Gate-də 1 kassa.",
      gateTitle: "Gate vs tutum",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 kassa, sonra 19 AZN",
        "Promo: platform_loyalty XOR retail_promotions",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#retail.",
      pricingCta: "Retail qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: "XOR loyallıq",
      xorChips: ["platform_loyalty", "retail_promotions"],
      bankNote: null,
    },
    auto: {
      kicker: "Peyk",
      title: "Auto STO",
      tagline: "Postlar, iş əmrləri, B2B ehtiyat hissələri.",
      gateTitle: "Gate vs tutum",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 post, sonra 19 AZN / post",
        "B2B ehtiyat və TecDoc normaları peyk modullarıdır",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#auto.",
      pricingCta: "Auto qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    logistics: {
      kicker: "Peyk",
      title: "Logistics",
      tagline: "Yol vərəqəsi, yanacaq, sürücü POD.",
      gateTitle: "Gate vs tutum",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 2 NQ, sonra 5 AZN / maşın",
        "Mobil sürücü və POD logistika konturundadır",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#logistics.",
      pricingCta: "Logistics qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    construction: {
      kicker: "Peyk",
      title: "Construction",
      tagline: "Obyektlər, smeta, aktlar, subpodrat.",
      gateTitle: "Gate vs tutum",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 obyekt, sonra 29 AZN / sahə",
        "Smeta və aktlar tikinti konturundadır",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#construction.",
      pricingCta: "Construction qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    wholesale: {
      kicker: "Peyk",
      title: "Wholesale",
      tagline: "Distribusiya və eyni VÖEN üzrə topdan.",
      gateTitle: "Gate vs tutum",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 anbar, sonra 19 AZN / anbar",
        "Topdanı Retail kassası ilə qarışdırmayın",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#wholesale.",
      pricingCta: "Wholesale qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    crm: {
      kicker: "Peyk",
      title: "CRM Field",
      tagline: "Sahə satışları. Gate-də 1 yer, sonra 5 AZN.",
      gateTitle: "Gate vs yer",
      gateBullets: [
        "Gate 29 AZN — tətbiq + 1 CRM yeri, sonra 5 AZN / seat",
        "Notifications Pack və Foundation ERP login (2 AZN) deyil",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#crm.",
      pricingCta: "CRM qiymətləri",
      registerCta: "Trial-a başla",
      xorTitle: null,
      xorChips: [],
      bankNote: null,
    },
    banking: {
      kicker: "Sandbox / Pilot",
      title: "Bank CBS",
      tagline: "Fintex şlüz. Kataloqdakı qiymətlər Sandbox / Pilot-dur, kommersiya ABS deyil.",
      gateTitle: "Gate vs production",
      gateBullets: [
        "Gate 99 AZN — Sandbox / Pilot siyahısında 1 filial",
        "banking_core 99 — sənaye CBS deyil",
        "Production (AzeriCard / AZIPS) — Custom Quote, setup 25 000 AZN-dən",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#banking.",
      pricingCta: "Banking qiymətləri",
      registerCta: "Pilot sorğusu",
      xorTitle: null,
      xorChips: [],
      bankNote:
        "SKU siyahısı tam bankı satmağa hazırlıq demək deyil. Capability Inventory-də trade/custody OUT-dur.",
    },
    "data-hub": {
      kicker: "Platforma",
      title: "Data HUB",
      tagline: "Soraqçalar və mübadilə. Üç tarif — yalnız biri.",
      gateTitle: "Bronze / Silver / Gold",
      gateBullets: [
        "XOR: Bronze · Silver · Gold — eyni anda bir SKU",
        "Sənaye peyki deyil: platform add-on rəfindədir",
      ],
      catalogNote: "Oryantir. Kanon — /pricing#addons.",
      pricingCta: "Add-on kataloqu",
      registerCta: "Trial-a başla",
      xorTitle: "XOR Data HUB",
      xorChips: ["Bronze", "Silver", "Gold"],
      bankNote: null,
    },
  },
};

export function getSatellitesIndexCopy(locale: Locale): SatellitesIndexCopy {
  return locale === "ru" ? ru.index : az.index;
}

export function getSatellitePageCopy(locale: Locale, slug: PublicSatelliteSlug): SatellitePageCopy {
  return (locale === "ru" ? ru : az).pages[slug];
}
