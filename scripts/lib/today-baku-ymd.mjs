/** Asia/Baku civil YYYY-MM-DD without pulling `@era/satellite-kit` into plain .mjs. */
export function todayBakuYmd(asOf = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
}
