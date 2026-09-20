import type {
  OrgTradeCreditPolicyDefaults,
  TradeCreditFeatureSnapshot,
  TradeCreditPolicyGroupCode,
  TradeCreditProposedKindCode,
} from "./trade-credit-policy.types";

export type SuggestTradeCreditLimitInput = {
  features: TradeCreditFeatureSnapshot;
  policy: OrgTradeCreditPolicyDefaults;
  /** Effective group after pin (null = thin). */
  group: TradeCreditPolicyGroupCode | null;
  thinHistory: boolean;
  lastRecognizedInvoiceAmount?: number | null;
};

export type SuggestTradeCreditLimitResult = {
  suggested: number;
  kind: TradeCreditProposedKindCode | null;
  reasons: string[];
  /** True when |suggested − creditLimit| / max(limit,1) < 0.05 — no proposal. */
  withinDeadband: boolean;
};

/**
 * Pure working-capital suggested limit (ADR Appendix B). No Nest/Prisma.
 */
export function suggestTradeCreditLimit(
  input: SuggestTradeCreditLimitInput,
): SuggestTradeCreditLimitResult {
  const { features, policy, group, thinHistory } = input;
  const reasons: string[] = [];
  const creditLimit = Math.max(0, features.creditLimit);

  if (group === "D") {
    reasons.push("group_d_zero");
    return {
      suggested: 0,
      kind: null,
      reasons,
      withinDeadband: creditLimit <= 0,
    };
  }

  if (thinHistory || group == null) {
    const last = Math.max(0, Number(input.lastRecognizedInvoiceAmount ?? 0));
    const suggested = roundMoney(
      Math.min(Math.max(0, policy.trialLimitAzn), last),
    );
    reasons.push("trial_thin_history");
    const withinDeadband = isWithinDeadband(suggested, creditLimit);
    return {
      suggested,
      kind: withinDeadband ? null : "TRIAL",
      reasons,
      withinDeadband,
    };
  }

  const avgMonthly = features.recognizedLast90 * (30 / 90);
  const termsDays =
    features.paymentTermsDays > 0 ? features.paymentTermsDays : 30;
  const termsFactor = termsDays / 30;
  const overdueFactor = Math.max(0, 1 - features.overdueShare);
  let raw = policy.limitK * avgMonthly * termsFactor * overdueFactor;
  reasons.push("raw_working_capital");

  let mult = 1;
  if (group === "A") mult = 1;
  else if (group === "B") mult = policy.groupMultB;
  else if (group === "C") mult = policy.groupMultC;
  reasons.push(`group_mult_${group}_${mult}`);

  if (features.partialPayRatio >= policy.partialPayThreshold) {
    mult *= policy.partialPayHaircut;
    reasons.push("partial_pay_haircut");
  }
  if (features.concentration >= policy.concentrationThreshold) {
    mult *= policy.concentrationHaircut;
    reasons.push("concentration_haircut");
  }

  const enrichRisky =
    features.enrichStale === true ? null : (features.riskyTaxpayer ?? null);
  const enrichInactive =
    features.enrichStale === true ? null : (features.voenInactive ?? null);
  const forceD =
    (policy.enrichRiskyForcesD && enrichRisky === true) ||
    (policy.enrichVoenInactiveForcesD && enrichInactive === true);
  let enrichHaircutApplied = false;
  if (
    !forceD &&
    (enrichRisky === true || enrichInactive === true)
  ) {
    mult *= policy.enrichHaircut;
    enrichHaircutApplied = true;
    reasons.push("enrich_haircut");
  }

  raw *= mult;

  let cap = Number.POSITIVE_INFINITY;
  if (policy.suggestedCapAzn != null && policy.suggestedCapAzn > 0) {
    cap = policy.suggestedCapAzn;
  } else if (policy.autoRaiseCapAzn != null && policy.autoRaiseCapAzn > 0) {
    cap = policy.autoRaiseCapAzn;
  }
  const floor = 0;
  let suggested = roundMoney(Math.min(Math.max(raw, floor), cap));
  if (Number.isFinite(cap) && suggested >= cap) {
    reasons.push("capped");
  }

  let kind: TradeCreditProposedKindCode | null = "WORKING_CAPITAL";
  if (enrichHaircutApplied && suggested < creditLimit) {
    kind = "ENRICH_HAIRCUT";
    suggested = roundMoney(Math.min(suggested, creditLimit));
  }

  const withinDeadband = isWithinDeadband(suggested, creditLimit);
  if (withinDeadband) {
    reasons.push("within_deadband");
    kind = null;
  }

  return { suggested, kind, reasons, withinDeadband };
}

export function isWithinDeadband(
  suggested: number,
  creditLimit: number,
  threshold = 0.05,
): boolean {
  const base = Math.max(creditLimit, 1);
  return Math.abs(suggested - creditLimit) / base < threshold;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
