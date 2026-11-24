import { addBakuDays } from "@/lib/baku-day";

/** Max stay plus one day before check-in and one after checkout. */
export const STAY_DAY_SLOTS = 23;

const MONTH_NAMES: Record<"az" | "en" | "ru", string[]> = {
  az: [
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "İyun",
    "İyul",
    "Avqust",
    "Sentyabr",
    "Oktyabr",
    "Noyabr",
    "Dekabr",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  ru: [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ],
};

export function stayMonthTitle(ymd: string, locale: string): string {
  const month = Number(ymd.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return ymd.slice(0, 7);
  const lang = locale.startsWith("ru") ? "ru" : locale.startsWith("en") ? "en" : "az";
  return MONTH_NAMES[lang][month - 1]!;
}

/** Check-in−1 … checkout+1 (shared with procedure-load heat). */
export function stayWindowDays(plan: {
  days: string[];
  checkoutYmd?: string | null;
}): string[] {
  if (plan.days.length === 0) return [];
  const checkIn = plan.days[0]!;
  const checkout = plan.checkoutYmd ?? plan.days[plan.days.length - 1]!;
  const days: string[] = [];
  for (
    let ymd = addBakuDays(checkIn, -1);
    ymd <= addBakuDays(checkout, 1) && days.length < 62;
    ymd = addBakuDays(ymd, 1)
  ) {
    days.push(ymd);
  }
  return days;
}

export function stayMonthSpans(days: string[]): Array<{ ymd: string; span: number }> {
  const monthSpans: Array<{ ymd: string; span: number }> = [];
  for (const ymd of days) {
    const prev = monthSpans[monthSpans.length - 1];
    if (prev && prev.ymd.slice(0, 7) === ymd.slice(0, 7)) prev.span += 1;
    else monthSpans.push({ ymd, span: 1 });
  }
  return monthSpans;
}
