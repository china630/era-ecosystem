const BAKU_TZ = "Asia/Baku";

export function bakuYmd(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, day };
}

function bakuOffsetMinutesAtUtcGuess(utcGuess: Date): number {
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKU_TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(utcGuess);
  const tzName =
    offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "+04";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offsetMin = 4 * 60;
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const h = Number(match[2]);
    const min = Number(match[3] ?? 0);
    offsetMin = sign * (h * 60 + min);
  }
  return offsetMin;
}

/** End of calendar day in Asia/Baku for a Y-M-D triplet. */
export function bakuEndOfDayUtc(y: number, m: number, day: number): Date {
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59.999`;
  const utcGuess = new Date(`${iso}Z`);
  const offsetMin = bakuOffsetMinutesAtUtcGuess(utcGuess);
  return new Date(utcGuess.getTime() - offsetMin * 60 * 1000);
}

/**
 * Platform trial end: last moment of calendar month `(registration month + months)` in Baku.
 * Example: 2026-06-10 → 2026-09-30 23:59:59.999 Baku.
 */
export function computeTrialExpiresEndOfMonthBaku(
  registrationAt: Date,
  months = 3,
): Date {
  const { y, m } = bakuYmd(registrationAt);
  const totalMonths = m - 1 + Math.max(1, Math.floor(months));
  const endY = y + Math.floor(totalMonths / 12);
  const endM = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
  return bakuEndOfDayUtc(endY, endM, lastDay);
}

/**
 * @deprecated Prefer {@link computeTrialExpiresEndOfMonthBaku} for org registration trials.
 * End of calendar day in Asia/Baku after adding `months` whole calendar months to signup (Baku date).
 */
export function computeTrialExpiresAtBaku(signupAt: Date, months = 3): Date {
  const { y, m, day } = bakuYmd(signupAt);
  const totalMonths = m - 1 + Math.max(1, Math.floor(months));
  const endY = y + Math.floor(totalMonths / 12);
  const endM = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
  const endDay = Math.min(day, lastDay);
  return bakuEndOfDayUtc(endY, endM, endDay);
}
