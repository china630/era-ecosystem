/**
 * Wall-clock visit stamps for diagnostics draft / prescribe.
 * Keep display formatting free of UTC shifts; do not invent 09:00 in the UI.
 */

/** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` → `dd.mm.yyyy` / `dd.mm.yyyy HH:mm`. */
export function formatDraftSchedule(scheduledAt: string): string {
  const raw = scheduledAt.trim();
  if (!raw) return "";
  const [ymd, hmRaw = ""] = raw.includes("T") ? raw.split("T") : [raw, ""];
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return raw;
  const datePart = `${d}.${m}.${y}`;
  const hm = hmRaw.slice(0, 5);
  return hm ? `${datePart} ${hm}` : datePart;
}

/** Visit schedule: date required for a stamp; time optional (no invented 09:00). */
export function buildVisitScheduledAt(
  dateYmd: string,
  timeHm: string,
): string | undefined {
  const ymd = dateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const hm = timeHm.trim().slice(0, 5);
  if (hm && /^\d{2}:\d{2}$/.test(hm)) return `${ymd}T${hm}`;
  return ymd;
}

/** Split a draft stamp back into date + optional HH:mm for editors. */
export function parseDraftSchedule(scheduledAt: string | undefined | null): {
  date: string;
  time: string;
} {
  const raw = (scheduledAt ?? "").trim();
  if (!raw) return { date: "", time: "" };
  const [ymd, hmRaw = ""] = raw.includes("T") ? raw.split("T") : [raw, ""];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : "";
  const hm = hmRaw.trim().slice(0, 5);
  const time = /^\d{2}:\d{2}$/.test(hm) ? hm : "";
  return { date, time };
}
