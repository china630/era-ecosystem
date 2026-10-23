import { Decimal } from "@erafinance/database";

export type DeclarationFilingStatus = "GENERATED" | "UPLOADED" | "CONFIRMED_BY_TAX";

export type SchemeRecalcDecision =
  | { kind: "unchanged"; previous: string; next: string }
  | { kind: "recalculate"; previous: string; next: string; delta: string }
  | { kind: "amendment"; previous: string; next: string; delta: string }
  | { kind: "keep_filed"; previous: string; next: string };

/**
 * GENERATED and UPLOADED are not filed: the amount is replaced in place.
 * CONFIRMED_BY_TAX is kept. A higher tax under a non-retroactive norm does not spawn a draft.
 */
export function decideSchemeRecalc(input: {
  status: DeclarationFilingStatus;
  previousAmount: string;
  nextAmount: string;
  retroactive: boolean;
}): SchemeRecalcDecision {
  const previous = new Decimal(input.previousAmount);
  const next = new Decimal(input.nextAmount);
  const previousText = previous.toFixed(2);
  const nextText = next.toFixed(2);
  const delta = next.sub(previous).toFixed(2);
  if (next.eq(previous)) {
    return { kind: "unchanged", previous: previousText, next: nextText };
  }
  if (input.status !== "CONFIRMED_BY_TAX") {
    return { kind: "recalculate", previous: previousText, next: nextText, delta };
  }
  if (next.gt(previous) && !input.retroactive) {
    return { kind: "keep_filed", previous: previousText, next: nextText };
  }
  return { kind: "amendment", previous: previousText, next: nextText, delta };
}

/** The next month stays open while an earlier amendment draft is not marked sent. */
export function amendmentBlocksClose(
  drafts: Array<{ status: string; period: string }>,
  closePeriod: string,
): boolean {
  return drafts.some((draft) => {
    if (draft.status !== "DRAFT") return false;
    const end = declarationPeriodEndMonth(draft.period);
    return end !== null && end < closePeriod;
  });
}

/** Month key of the declaration. A quarter ends on its last month; a year ends in December. */
export function declarationPeriodEndMonth(period: string): string | null {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) {
    const endMonth = String(Number(quarter[2]) * 3).padStart(2, "0");
    return `${quarter[1]}-${endMonth}`;
  }
  const year = /^(\d{4})$/.exec(period);
  if (year) return `${year[1]}-12`;
  return null;
}
