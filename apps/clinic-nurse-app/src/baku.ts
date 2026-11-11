/** Asia/Baku wall clock. Year-round UTC+4. Mirrors @era/satellite-kit/time for the device bundle. */

const TZ = "Asia/Baku";
const OFFSET = "+04:00";

export function todayBakuYmd(asOf = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
}

export function bakuTimeLabel(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function bakuDateDisplay(ymd: string): string {
  const [y, m, day] = ymd.split("-");
  return `${day}.${m}.${y}`;
}

export function parseBakuDateTime(ymd: string, hhmm: string): Date {
  const t = /^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : hhmm;
  return new Date(`${ymd}T${t}${OFFSET}`);
}
