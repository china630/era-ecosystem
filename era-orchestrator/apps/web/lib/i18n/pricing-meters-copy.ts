import type { Locale } from "@era/i18n-common";

export type PricingMeterRow = {
  id: string;
  label: string;
  included: string;
  overage: string;
};

export type PricingMetersCopy = {
  tocTitle: string;
  tocCore: string;
  tocBundles: string;
  tocIndustries: string;
  tocAddons: string;
  tocPremium: string;
  tocMeters: string;
  tocSpend: string;
  metersTitle: string;
  metersHint: string;
  metersCanonNote: string;
  includedCol: string;
  overageCol: string;
  spendTitle: string;
  spendHint: string;
  unavailableBanner: string;
  unavailableSkuNote: string;
  rows: PricingMeterRow[];
};

const ru: PricingMetersCopy = {
  tocTitle: "Содержание",
  tocCore: "ERA Core",
  tocBundles: "Пакеты",
  tocIndustries: "Спутники",
  tocAddons: "Add-on",
  tocPremium: "Premium",
  tocMeters: "Метры",
  tocSpend: "Потолок расхода",
  metersTitle: "Метры и ёмкость",
  metersHint:
    "После включённого лимита — постоплата. Счета входят в документы. Workforce 2/4 — XOR, не путать с ERP-логином Foundation.",
  metersCanonNote: "Таблица канона каталога. Живые SKU модулей — в секциях выше, когда API отвечает.",
  includedCol: "Включено",
  overageCol: "Сверх лимита",
  spendTitle: "Потолок расхода (вторично)",
  spendHint:
    "Spend tier — страховка постоплаты, не продукт. SKU и метры выше важнее T0–T3.",
  unavailableBanner: "Живой список SKU временно недоступен. Ниже — канон метров; конструктор модулей появится, когда API ответит.",
  unavailableSkuNote: "Секции Core / спутники / add-on скрыты, пока GET /v1/public/pricing не вернёт каталог.",
  rows: [
    { id: "ocr", label: "OCR", included: "50 стр. в Foundation", overage: "0.02 AZN / стр." },
    { id: "docs", label: "Документы (вкл. счета)", included: "1000 / мес в NAS", overage: "5 AZN / 1000" },
    { id: "storage", label: "Хранение", included: "20 GB в SKU Storage 19 AZN", overage: "0.50 AZN / GB" },
    { id: "sms", label: "SMS", included: "Оператор + платформа", overage: "оператор + 0.01 AZN" },
    { id: "wa", label: "WhatsApp", included: "По факту", overage: "0.05 AZN / сообщение" },
    { id: "erp", label: "ERP-логин Foundation", included: "1 в Foundation", overage: "2 AZN / логин" },
    { id: "legal", label: "Юрлицо", included: "1 в Foundation", overage: "19 AZN / VÖEN" },
    { id: "headcount", label: "Headcount Workforce", included: "нет (XOR Base/PRO)", overage: "2 AZN Base XOR 4 AZN PRO" },
    { id: "rooms", label: "Номера (Hotel)", included: "5 в Gate", overage: "4 AZN / номер" },
    { id: "cabinet", label: "Кабинет (Clinic)", included: "1 в Gate", overage: "19 AZN / кабинет" },
    { id: "pos", label: "POS / касса / пост", included: "1 в Gate (F&B, Retail, Auto)", overage: "19 AZN / единица" },
    { id: "vehicle", label: "ТС (Logistics)", included: "2 в Gate", overage: "5 AZN / машина" },
    { id: "site", label: "Площадка (Construction)", included: "1 в Gate", overage: "29 AZN / объект" },
    { id: "wh", label: "Склад (Wholesale)", included: "1 в Gate", overage: "19 AZN / склад" },
    { id: "crm", label: "CRM seat", included: "1 в Gate", overage: "5 AZN / место" },
    { id: "branch", label: "Филиал (Bank)", included: "1 в Gate", overage: "39 AZN / филиал" },
    { id: "outlet", label: "Outlet (общий)", included: "по Gate вертикали", overage: "19 AZN" },
    { id: "acq", label: "Эквайринг", included: "—", overage: "1.5%" },
  ],
};

const az: PricingMetersCopy = {
  tocTitle: "Mündəricat",
  tocCore: "ERA Core",
  tocBundles: "Paketlər",
  tocIndustries: "Peyklər",
  tocAddons: "Add-on",
  tocPremium: "Premium",
  tocMeters: "Metrlər",
  tocSpend: "Xərc tavanı",
  metersTitle: "Metrlər və tutum",
  metersHint:
    "Daxil limitdən sonra post-ödəniş. Qaimələr sənədlərə daxildir. Workforce 2/4 XOR-dur, Foundation ERP login deyil.",
  metersCanonNote: "Kataloq kanonu. Canlı SKU-lar API cavab verəndə yuxarı bölmələrdədir.",
  includedCol: "Daxildir",
  overageCol: "Limitdən artıq",
  spendTitle: "Xərc tavanı (ikinci dərəcəli)",
  spendHint: "Spend tier post-ödəniş sığortasıdır, məhsul deyil. SKU və metrlər T0–T3-dən vacibdir.",
  unavailableBanner:
    "Canlı SKU siyahısı müvəqqəti əlçatan deyil. Aşağıda metr kanonu var; API cavab verəndə konstruktor görünəcək.",
  unavailableSkuNote: "Core / peyk / add-on bölmələri GET /v1/public/pricing kataloqu qaytarana qədər gizlidir.",
  rows: [
    { id: "ocr", label: "OCR", included: "Foundation-da 50 səhifə", overage: "0.02 AZN / səh." },
    { id: "docs", label: "Sənədlər (qaimələr daxil)", included: "NAS-da 1000 / ay", overage: "5 AZN / 1000" },
    { id: "storage", label: "Yaddaş", included: "Storage SKU 19 AZN-də 20 GB", overage: "0.50 AZN / GB" },
    { id: "sms", label: "SMS", included: "Operator + platforma", overage: "operator + 0.01 AZN" },
    { id: "wa", label: "WhatsApp", included: "Fakt üzrə", overage: "0.05 AZN / mesaj" },
    { id: "erp", label: "Foundation ERP login", included: "Foundation-da 1", overage: "2 AZN / login" },
    { id: "legal", label: "Hüquqi şəxs", included: "Foundation-da 1", overage: "19 AZN / VÖEN" },
    { id: "headcount", label: "Workforce headcount", included: "yox (XOR Base/PRO)", overage: "2 AZN Base XOR 4 AZN PRO" },
    { id: "rooms", label: "Otaq (Hotel)", included: "Gate-də 5", overage: "4 AZN / otaq" },
    { id: "cabinet", label: "Kabinet (Clinic)", included: "Gate-də 1", overage: "19 AZN / kabinet" },
    { id: "pos", label: "POS / kassa / post", included: "Gate-də 1 (F&B, Retail, Auto)", overage: "19 AZN / vahid" },
    { id: "vehicle", label: "NQ (Logistics)", included: "Gate-də 2", overage: "5 AZN / maşın" },
    { id: "site", label: "Sahə (Construction)", included: "Gate-də 1", overage: "29 AZN / obyekt" },
    { id: "wh", label: "Anbar (Wholesale)", included: "Gate-də 1", overage: "19 AZN / anbar" },
    { id: "crm", label: "CRM yer", included: "Gate-də 1", overage: "5 AZN / yer" },
    { id: "branch", label: "Filial (Bank)", included: "Gate-də 1", overage: "39 AZN / filial" },
    { id: "outlet", label: "Outlet (ümumi)", included: "vertikal Gate üzrə", overage: "19 AZN" },
    { id: "acq", label: "Ekvarinq", included: "—", overage: "1.5%" },
  ],
};

export function getPricingMetersCopy(locale: Locale): PricingMetersCopy {
  return locale === "ru" ? ru : az;
}
