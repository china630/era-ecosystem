import { isClosedWeekday, getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { isElectiveSchedulingAllowed } from "@/lib/production-calendar";
import { bakuDateKey } from "@/lib/baku-day";

const BAKU_OFFSET = "+04:00";

/**
 * Same gates as the doctor board: clinic closed weekdays and the production calendar.
 * Returns CLOSED_DAY when a new elective visit must not be placed on that instant.
 */
export async function electiveDayDenied(at: Date): Promise<"CLOSED_DAY" | null> {
  const ymd = bakuDateKey(at);
  const noon = new Date(`${ymd}T12:00:00${BAKU_OFFSET}`);
  const settings = await getSchedulingSettings();
  if (isClosedWeekday(noon, settings.closedWeekdays)) return "CLOSED_DAY";
  if (!(await isElectiveSchedulingAllowed(noon))) return "CLOSED_DAY";
  return null;
}
