import { addCalendarBusinessDays } from "@era/satellite-kit";

export async function crmNextContactDue(fromIso: string, offsetBusinessDays: number): Promise<string> {
  return addCalendarBusinessDays(fromIso, offsetBusinessDays);
}
