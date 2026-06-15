import { addCalendarBusinessDays, isCalendarWorkingDay } from "@era/satellite-kit";

export async function isConstructionWorkingDay(isoDate: string): Promise<boolean> {
  return isCalendarWorkingDay(isoDate);
}

export async function constructionSlaDueDate(fromIso: string, businessDays: number): Promise<string> {
  return addCalendarBusinessDays(fromIso, businessDays);
}
