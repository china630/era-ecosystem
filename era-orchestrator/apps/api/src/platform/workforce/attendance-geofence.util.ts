/** Haversine distance in meters (WGS84). */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Minutes from Asia/Baku local midnight [0, 1440). Date must already be interpreted in Baku. */
export function bakuMinuteOfDay(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/**
 * True when local minute is outside [start - grace, end + grace].
 * Night shifts may cross midnight (start > end).
 */
export function isOutsideShiftWindow(
  minuteOfDay: number,
  startMinute: number,
  endMinute: number,
  graceMinutes: number,
): boolean {
  const g = Math.max(0, graceMinutes);
  if (startMinute === endMinute) {
    return false;
  }
  if (startMinute < endMinute) {
    const lo = Math.max(0, startMinute - g);
    const hi = Math.min(1440, endMinute + g);
    return minuteOfDay < lo || minuteOfDay > hi;
  }
  // Crosses midnight: in-window if >= start-g OR <= end+g
  const loStart = Math.max(0, startMinute - g);
  const hiEnd = Math.min(1440, endMinute + g);
  const inWindow = minuteOfDay >= loStart || minuteOfDay <= hiEnd;
  return !inWindow;
}
