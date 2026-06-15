/** AZ production calendar day taxonomy (era-data-hub CalendarDay). */
export type CalendarDayType =
  | "working"
  | "weekend"
  | "holiday"
  | "transferred_rest"
  | "transferred_working"
  | "mourning"
  | "shortened";

export type CalendarDayPoint = {
  country: string;
  date: string;
  isWorking: boolean;
  dayType: CalendarDayType;
  labelAz?: string | null;
  labelRu?: string | null;
  labelEn?: string | null;
};

export type CalendarDayResponse = CalendarDayPoint & {
  meta?: Record<string, unknown>;
};

export type CalendarDaysBulkResponse = {
  meta?: Record<string, unknown>;
  country: string;
  from: string;
  to: string;
  days: CalendarDayPoint[];
};

export type CalendarAddBusinessDaysResponse = {
  meta?: Record<string, unknown>;
  country: string;
  startDate: string;
  businessDaysAdded: number;
  resultDate: string;
};

/** Demand premium multiplier for hotel auto-BAR (ADR production-calendar-ecosystem). */
export function demandPremiumMultiplier(
  dayType: CalendarDayType,
  configuredPremium = 1.5,
): number {
  if (dayType === "mourning") return 1.0;
  if (
    dayType === "weekend" ||
    dayType === "holiday" ||
    dayType === "transferred_rest" ||
    dayType === "transferred_working"
  ) {
    return configuredPremium;
  }
  return 1.0;
}
