import type { Locale } from "@era/i18n-common";

/** Glossary labels for public site chrome (az / ru / en). */
export type SiteNavLabels = {
  solutions: string;
  industries: string;
  pricing: string;
  resources: string;
  calculator: string;
  login: string;
  signup: string;
  ctaDemo: string;
  ctaTrial: string;
  allSolutions: string;
  allIndustries: string;
  includes: string;
  pilot: string;
  calcCardTitle: string;
  calcCardCta: string;
  faq: string;
  partner: string;
  contact: string;
  terms: string;
  platformCore: string;
  industryProducts: string;
  viewProduct: string;
  requestDemo: string;
  modules: string;
  solutionsBlurb: string;
  minCardHint: string;
  calcForIndustry: string;
  help: string;
};

const az: SiteNavLabels = {
  solutions: "Həllər",
  industries: "Sənayelər",
  pricing: "Tariflər",
  resources: "Resurslar",
  calculator: "Kalkulyator",
  login: "Daxil ol",
  signup: "Qeydiyyat",
  ctaDemo: "Demo sifariş et",
  ctaTrial: "3 ay pulsuz",
  allSolutions: "Bütün məhsullar",
  allIndustries: "Bütün sənayələr",
  includes: "Daxildə",
  pilot: "Pilot",
  calcCardTitle: "Abunəni bir neçə dəqiqəyə yığın",
  calcCardCta: "Kalkulyatoru aç",
  faq: "Tez-tez verilən suallar",
  partner: "Partnyorlar",
  contact: "Əlaqə",
  terms: "Şərtlər",
  platformCore: "Platformanın əsas məhsulları",
  industryProducts: "Sənaye məhsulları",
  viewProduct: "Məhsula bax",
  requestDemo: "Demo sifariş et",
  modules: "Modullar",
  solutionsBlurb: "ERA 365 məhsulları — uçot və sənaye həlləri bir platformada.",
  minCardHint: "Ətraflı təsvir tezliklə əlavə olunacaq. Aşağıda modulların siyahısı var.",
  calcForIndustry: "Bu sənaye üçün hesabla",
  help: "Kömək",
};

const ru: SiteNavLabels = {
  solutions: "Решения",
  industries: "Отрасли",
  pricing: "Тарифы",
  resources: "Ресурсы",
  calculator: "Калькулятор",
  login: "Войти",
  signup: "Регистрация",
  ctaDemo: "Запросить демо",
  ctaTrial: "3 месяца бесплатно",
  allSolutions: "Все решения",
  allIndustries: "Все отрасли",
  includes: "Что входит",
  pilot: "Pilot",
  calcCardTitle: "Соберите подписку за пару минут",
  calcCardCta: "Открыть калькулятор",
  faq: "Вопросы и ответы",
  partner: "Партнёрам",
  contact: "Контакты",
  terms: "Условия",
  platformCore: "Основа платформы",
  industryProducts: "Отраслевые продукты",
  viewProduct: "О продукте",
  requestDemo: "Запросить демо",
  modules: "Модули",
  solutionsBlurb: "Продукты ERA 365 — учёт и отраслевые решения на одной платформе.",
  minCardHint: "Подробное описание появится позже. Ниже — список модулей.",
  calcForIndustry: "Рассчитать для этой отрасли",
  help: "Помощь",
};

const en: SiteNavLabels = {
  solutions: "Solutions",
  industries: "Industries",
  pricing: "Pricing",
  resources: "Resources",
  calculator: "Calculator",
  login: "Sign in",
  signup: "Sign up",
  ctaDemo: "Request a demo",
  ctaTrial: "3 months free",
  allSolutions: "All solutions",
  allIndustries: "All industries",
  includes: "What is included",
  pilot: "Pilot",
  calcCardTitle: "Build your subscription in minutes",
  calcCardCta: "Open calculator",
  faq: "FAQ",
  partner: "Partners",
  contact: "Contact",
  terms: "Terms",
  platformCore: "Platform foundation",
  industryProducts: "Industry products",
  viewProduct: "View product",
  requestDemo: "Request a demo",
  modules: "Modules",
  solutionsBlurb: "ERA 365 products — accounting and industry solutions on one platform.",
  minCardHint: "A longer description will be added later. Modules are listed below.",
  calcForIndustry: "Calculate for this industry",
  help: "Help",
};

export function getSiteNavCopy(locale: Locale): SiteNavLabels {
  if (locale === "ru") return ru;
  if (locale === "en") return en;
  return az;
}