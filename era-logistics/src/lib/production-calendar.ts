import { addCalendarBusinessDays, isCalendarWorkingDay } from "@era/satellite-kit";

export async function logisticsEtaDate(fromIso: string, transitBusinessDays: number): Promise<string> {
  return addCalendarBusinessDays(fromIso, transitBusinessDays);
}

export async function isLogisticsOperatingDay(isoDate: string): Promise<boolean> {
  return isCalendarWorkingDay(isoDate);
}
