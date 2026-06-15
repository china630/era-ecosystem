import { addCalendarBusinessDays, isCalendarWorkingDay } from "@era/satellite-kit";

export async function nextServiceAppointmentDay(fromIso: string): Promise<string> {
  let cursor = fromIso;
  for (let i = 0; i < 14; i++) {
    if (await isCalendarWorkingDay(cursor)) return cursor;
    cursor = await addCalendarBusinessDays(cursor, 1);
  }
  return cursor;
}
