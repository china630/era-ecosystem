import { addBakuDays, bakuDateKey } from "@/lib/baku-day";
import { listClinicDays } from "@/domain/planning/clinic-day";

/**
 * Same gate as procedure seating: clinic week template and manual day overrides.
 * Returns CLOSED_DAY when a new elective visit must not be placed on that instant.
 */
export async function electiveDayDenied(at: Date): Promise<"CLOSED_DAY" | null> {
  const ymd = bakuDateKey(at);
  const days = await listClinicDays(ymd, addBakuDays(ymd, 1));
  if (days[0] && !days[0].working) return "CLOSED_DAY";
  return null;
}
