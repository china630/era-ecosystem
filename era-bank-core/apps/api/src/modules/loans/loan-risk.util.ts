/**
 * IFRS9 stage suggestion from days past due (TZ §12.4 simplified).
 * Stage 1: performing / <30 DPD
 * Stage 2: 30–89 DPD
 * Stage 3: ≥90 DPD (NPL)
 */
export function suggestIfrs9StageFromDpd(daysPastDue: number): 1 | 2 | 3 {
  if (daysPastDue >= 90) return 3;
  if (daysPastDue >= 30) return 2;
  return 1;
}

export function computeDaysPastDue(
  dueDates: Array<{ dueDate: Date; status: string }>,
  asOf: Date = new Date(),
): number {
  const overdue = dueDates.filter(
    (i) =>
      i.status !== "PAID" &&
      i.status !== "CLOSED" &&
      i.dueDate.getTime() < asOf.getTime(),
  );
  if (overdue.length === 0) return 0;
  let oldest = overdue[0].dueDate;
  for (const item of overdue) {
    if (item.dueDate.getTime() < oldest.getTime()) {
      oldest = item.dueDate;
    }
  }
  const ms = asOf.getTime() - oldest.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export type CollateralPayload = {
  description: string;
  amountMinor: string;
  currency: string;
  type?: string;
};

export function parseCollateralRef(
  raw: string | null | undefined,
): CollateralPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CollateralPayload;
    if (parsed && typeof parsed.description === "string") return parsed;
  } catch {
    return { description: raw, amountMinor: "0", currency: "AZN" };
  }
  return null;
}

export function serializeCollateral(payload: CollateralPayload): string {
  return JSON.stringify({
    description: payload.description,
    amountMinor: String(payload.amountMinor),
    currency: payload.currency || "AZN",
    type: payload.type ?? "OTHER",
  });
}
