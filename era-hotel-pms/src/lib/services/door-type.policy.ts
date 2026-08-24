export function physicalTypeAllowedForDoor(opts: {
  chargedRoomTypeId: string;
  givenRoomTypeId: string | null | undefined;
  doorRoomTypeId: string;
  compUpgrade: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (opts.doorRoomTypeId === opts.chargedRoomTypeId) return { ok: true };
  if (opts.givenRoomTypeId && opts.doorRoomTypeId === opts.givenRoomTypeId) return { ok: true };
  if (opts.compUpgrade) return { ok: true };
  return {
    ok: false,
    error: 'Room type mismatch — use product change from date (paid type change)',
  };
}

export function scaleLinesToSell(
  lines: Array<{ amount: number }>,
  sellAmount: number,
): number[] {
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (lines.length === 0) return [];
  if (sum <= 0) {
    const each = Math.round((sellAmount / lines.length) * 100) / 100;
    const out = lines.map(() => each);
    const drift = Math.round((sellAmount - out.reduce((a, b) => a + b, 0)) * 100) / 100;
    out[out.length - 1] = Math.round((out[out.length - 1] + drift) * 100) / 100;
    return out;
  }
  const scaled = lines.map((l) => Math.round(((l.amount * sellAmount) / sum) * 100) / 100);
  const drift = Math.round((sellAmount - scaled.reduce((a, b) => a + b, 0)) * 100) / 100;
  scaled[scaled.length - 1] = Math.round((scaled[scaled.length - 1] + drift) * 100) / 100;
  return scaled;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateOnlyUtc(d: Date): Date {
  return new Date(`${isoDate(d)}T00:00:00.000Z`);
}

/** Even split with remainder qapiks on the last night. */
export function splitStayAmounts(total: number, nightCount: number): number[] {
  if (nightCount <= 0) return [];
  const each = Math.floor((Math.round(total * 100) / nightCount)) / 100;
  const amounts = Array.from({ length: nightCount }, () => each);
  const head = Math.round(each * (nightCount - 1) * 100) / 100;
  amounts[nightCount - 1] = Math.round((total - head) * 100) / 100;
  return amounts;
}

export function rateAdjExternalRef(reservationId: string, businessDate: string): string {
  return `rate-adj:${reservationId}:${businessDate}`;
}

export function classifyAmendmentFolioImpact(opts: {
  tonightPosted: boolean;
  effectiveIsToday: boolean;
  differenceAmount: number;
}): "FUTURE_EOD" | "DIFFERENCE_LINE" | "NONE" {
  if (!opts.tonightPosted || !opts.effectiveIsToday) return "FUTURE_EOD";
  if (opts.differenceAmount === 0) return "NONE";
  return "DIFFERENCE_LINE";
}
