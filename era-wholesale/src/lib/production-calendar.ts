import { addCalendarBusinessDays } from "@era/satellite-kit";

/** Payment / delivery term on AZ production calendar business days. */
export async function wholesaleTermDueDate(orderDateIso: string, termDays: number): Promise<string> {
  return addCalendarBusinessDays(orderDateIso, termDays);
}
