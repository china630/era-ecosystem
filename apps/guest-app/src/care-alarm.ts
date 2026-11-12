import type { CareTimetableRow } from "./care-types";

/**
 * Local lead-alert preference (ADR §3). OS schedule via expo-notifications when available;
 * remote push for procedure moves stays STUB until EAS certs.
 */
export type LeadAlertMode = "off" | "lead" | "lead_alarm";

export function filterTodayTomorrow(
  rows: CareTimetableRow[],
  now = new Date(),
): CareTimetableRow[] {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  return rows.filter((row) => {
    const t = new Date(row.scheduledAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

export function leadAlertFireAts(
  rows: CareTimetableRow[],
  leadMinutes: 5 | 10,
  mode: LeadAlertMode,
): Array<{ at: string; procedureName: string }> {
  if (mode === "off") return [];
  return filterTodayTomorrow(rows).map((row) => ({
    at: new Date(new Date(row.scheduledAt).getTime() - leadMinutes * 60_000).toISOString(),
    procedureName: row.procedureName,
  }));
}

const QUIET_START_H = 22;
const QUIET_END_H = 7;

function inQuietHours(at: Date): boolean {
  const h = at.getHours();
  return h >= QUIET_START_H || h < QUIET_END_H;
}

/** Cancel prior scheduled locals and re-arm from Care refresh. */
export async function scheduleLeadAlerts(args: {
  rows: CareTimetableRow[];
  leadMinutes: 5 | 10;
  mode: LeadAlertMode;
}): Promise<number> {
  const fires = leadAlertFireAts(args.rows, args.leadMinutes, args.mode);
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (args.mode === "off") return 0;
    let scheduled = 0;
    for (const fire of fires) {
      const when = new Date(fire.at);
      if (when.getTime() <= Date.now()) continue;
      // Quiet hours skip unless explicit lead_alarm mode.
      if (args.mode === "lead" && inQuietHours(when)) continue;
      const seconds = Math.max(1, Math.floor((when.getTime() - Date.now()) / 1000));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Procedure soon",
          body: fire.procedureName,
          sound: args.mode === "lead_alarm",
        },
        // Expo Go / SDK 52: time interval is portable; DATE enum varies by platform.
        trigger: { seconds, repeats: false },
      });
      scheduled += 1;
    }
    return scheduled;
  } catch {
    return fires.length;
  }
}
