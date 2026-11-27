import type { Locale } from "@era/i18n-common";

export type ArchitectureMapCopy = {
  mapTitle: string;
  mapDesc: string;
  platformBand: string;
  filterAll: string;
  legendLive: string;
  legendPartial: string;
  legendPlanned: string;
  legendFolio: string;
  viewProduct: string;
  fromMonth: string;
  fromPerson: string;
  maturityProd: string;
  maturityPilot: string;
  maturityDev: string;
  mobileCores: string;
  mobileProducts: string;
  /** Fallback labels for module nodes without a public satellite row. */
  moduleNodeNames: Record<string, string>;
  moduleNodeTags: Record<string, string>;
};

const COPY: Record<Locale, ArchitectureMapCopy> = {
  ru: {
    mapTitle: "Схема архитектуры ERA 365",
    mapDesc:
      "Оркестратор — платформа. Два ядра: ERA Core и Bank CBS. Сплошная линия — связь в коде, пунктир — в разработке.",
    platformBand: "Оркестратор — платформа · идентичность · биллинг · каталог",
    filterAll: "Все",
    legendLive: "есть в коде",
    legendPartial: "частично",
    legendPlanned: "в разработке",
    legendFolio: "фолио / жизненный цикл",
    viewProduct: "Открыть продукт",
    fromMonth: "от {n} AZN / мес",
    fromPerson: "от {n} AZN / чел",
    maturityProd: "Production",
    maturityPilot: "Pilot",
    maturityDev: "В разработке",
    mobileCores: "Ядра",
    mobileProducts: "Продукты и платформа",
    moduleNodeNames: { banking_dbo: "ДБО" },
    moduleNodeTags: { banking_dbo: "модуль банка · Pilot" },
  },
  az: {
    mapTitle: "ERA 365 arxitektura sxemi",
    mapDesc:
      "Orkestrator — platforma. İki nüvə: ERA Core və Bank CBS. Tam xətt — kodda əlaqə, nöqtəli — hazırlanır.",
    platformBand: "Orkestrator — platforma · identiklik · billing · kataloq",
    filterAll: "Hamısı",
    legendLive: "kodda var",
    legendPartial: "qismən",
    legendPlanned: "hazırlanır",
    legendFolio: "folio / həyat dövrü",
    viewProduct: "Məhsula keç",
    fromMonth: "{n} AZN-dan / ay",
    fromPerson: "{n} AZN-dan / nəfər",
    maturityProd: "Production",
    maturityPilot: "Pilot",
    maturityDev: "Hazırlanır",
    mobileCores: "Nüvələr",
    mobileProducts: "Məhsullar və platforma",
    moduleNodeNames: { banking_dbo: "DBO" },
    moduleNodeTags: { banking_dbo: "bank moduli · Pilot" },
  },
  en: {
    mapTitle: "ERA 365 architecture map",
    mapDesc:
      "Orchestrator is the platform band. Two cores: ERA Core and Bank CBS. Solid line — live integration; dashed — planned.",
    platformBand: "Orchestrator — platform · identity · billing · catalog",
    filterAll: "All",
    legendLive: "live in code",
    legendPartial: "partial",
    legendPlanned: "planned",
    legendFolio: "folio / lifecycle",
    viewProduct: "View product",
    fromMonth: "from {n} AZN / mo",
    fromPerson: "from {n} AZN / person",
    maturityProd: "Production",
    maturityPilot: "Pilot",
    maturityDev: "In development",
    mobileCores: "Cores",
    mobileProducts: "Products and platform",
    moduleNodeNames: { banking_dbo: "DBO" },
    moduleNodeTags: { banking_dbo: "bank module · Pilot" },
  },
};

export function getArchitectureMapCopy(locale: Locale): ArchitectureMapCopy {
  return COPY[locale] ?? COPY.az;
}

export function formatArchPrice(
  template: string,
  value: number,
): string {
  const n = value % 1 === 0 ? String(Math.round(value)) : value.toFixed(2);
  return template.replace("{n}", n);
}