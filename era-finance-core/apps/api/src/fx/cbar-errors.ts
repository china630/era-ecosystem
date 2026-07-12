/** Thrown when live CBAR HTTP is disabled (TAX_LOOKUP_MOCK=1) or finance no longer fetches CBAR. */
export class CbarExternalFetchDisabledError extends Error {
  readonly code = "CBAR_EXTERNAL_FETCH_DISABLED" as const;
  constructor(message = "CBAR external fetch disabled") {
    super(message);
    this.name = "CbarExternalFetchDisabledError";
  }
}

/** Format date as DD.MM.YYYY in Asia/Baku (legacy CBAR XML calendar key). */
export function formatBakuDateDdMmYyyy(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  if (!day || !month || !year) {
    const iso = d.toISOString().slice(0, 10);
    const [y, m, dd] = iso.split("-");
    return `${dd}.${m}.${y}`;
  }
  return `${day}.${month}.${year}`;
}
