import type {
  OrgTradeCreditPolicyDefaults,
  TradeCreditClassifyResult,
  TradeCreditFeatureSnapshot,
  TradeCreditPolicyGroupCode,
} from "./trade-credit-policy.types";

type SignalLevel = "high" | "low" | "mid";

/**
 * Pure A–D classifier (ADR finance-trade-credit-control Appendix A + Phase 3).
 * No Nest DI / Prisma — unit-testable.
 */
export function classifyTradeCredit(
  features: TradeCreditFeatureSnapshot,
  policy: Pick<
    OrgTradeCreditPolicyDefaults,
    | "autoDMaxDpd"
    | "minPaidInvoices"
    | "enrichRiskyForcesD"
    | "enrichVoenInactiveForcesD"
  >,
): TradeCreditClassifyResult {
  const reasons: string[] = [];
  const enrichRisky =
    features.enrichStale === true ? null : (features.riskyTaxpayer ?? null);
  const enrichInactive =
    features.enrichStale === true ? null : (features.voenInactive ?? null);

  if (features.paidInvoiceCount < policy.minPaidInvoices) {
    reasons.push("thin_history");
    reasons.push(
      `paid_invoices_${features.paidInvoiceCount}_lt_${policy.minPaidInvoices}`,
    );
    return {
      group: null,
      reasons,
      features,
      thinHistory: true,
    };
  }

  if (features.maxDpd >= policy.autoDMaxDpd) {
    reasons.push("hard_max_dpd");
    reasons.push(`max_dpd_${features.maxDpd}_gte_${policy.autoDMaxDpd}`);
    return {
      group: "D",
      reasons,
      features,
      thinHistory: false,
    };
  }

  // Phase 2b optional bureau-driven D (off by default); ignore stale enrich
  if (policy.enrichRiskyForcesD && enrichRisky === true) {
    reasons.push("enrich_risky_forces_d");
    return {
      group: "D",
      reasons,
      features,
      thinHistory: false,
    };
  }
  if (policy.enrichVoenInactiveForcesD && enrichInactive === true) {
    reasons.push("enrich_voen_inactive_forces_d");
    return {
      group: "D",
      reasons,
      features,
      thinHistory: false,
    };
  }
  if (enrichRisky === true) {
    reasons.push("enrich_risky_informational");
  }
  if (enrichInactive === true) {
    reasons.push("enrich_voen_inactive_informational");
  }
  if (features.enrichStale === true) {
    reasons.push("enrich_stale_ignored");
  }

  const willingness = scoreWillingness(features, reasons);
  const ability = scoreAbility(features, reasons);
  const group = mapWillingnessAbility(willingness, ability, reasons);

  if (
    features.utilization >= 0.85 &&
    features.overdueShare < 0.05 &&
    group !== "D"
  ) {
    reasons.push("utilization_raise_alert");
  }

  return {
    group,
    reasons,
    features,
    thinHistory: false,
  };
}

function scoreWillingness(
  features: TradeCreditFeatureSnapshot,
  reasons: string[],
): SignalLevel {
  const avg = Number.isFinite(features.weightedAvgDpd)
    ? features.weightedAvgDpd
    : features.avgDpd;

  if (features.partialPayRatio >= 0.5) {
    reasons.push("partial_pay_drag");
  }

  const high =
    avg <= 7 &&
    features.overdueShare < 0.15 &&
    features.partialPayRatio < 0.5;
  const low = features.maxDpd >= 30 || features.overdueShare >= 0.4;

  if (high) {
    reasons.push("willingness_high");
    return "high";
  }
  if (low) {
    reasons.push("willingness_low");
    return "low";
  }
  reasons.push("willingness_mid");
  return "mid";
}

function scoreAbility(
  features: TradeCreditFeatureSnapshot,
  reasons: string[],
): SignalLevel {
  // Phase 3: utilization removed from ability; use seasonal YoY when available.
  const trend =
    features.turnoverTrendYoy != null &&
    Number.isFinite(features.turnoverTrendYoy)
      ? features.turnoverTrendYoy
      : features.turnoverTrend;
  if (features.turnoverTrendYoy != null) {
    reasons.push("ability_uses_yoy");
  } else {
    reasons.push("ability_uses_dual90");
  }

  const high = trend > -0.25;
  const low = trend <= -0.25;

  if (high) {
    reasons.push("ability_high");
    return "high";
  }
  if (low) {
    reasons.push("ability_low");
    return "low";
  }
  reasons.push("ability_mid");
  return "mid";
}

function mapWillingnessAbility(
  willingness: SignalLevel,
  ability: SignalLevel,
  reasons: string[],
): TradeCreditPolicyGroupCode | null {
  if (willingness === "high" && ability === "high") {
    reasons.push("mapped_A");
    return "A";
  }
  if (willingness === "high" && ability === "low") {
    reasons.push("mapped_B");
    return "B";
  }
  if (willingness === "low" && ability === "high") {
    reasons.push("mapped_C");
    return "C";
  }
  if (willingness === "low" && ability === "low") {
    reasons.push("mapped_D");
    return "D";
  }

  // Mid signals: prefer B if willingness high else C if ability high else conservative B
  if (willingness === "high") {
    reasons.push("mapped_B_mid_ability");
    return "B";
  }
  if (ability === "high") {
    reasons.push("mapped_C_mid_willingness");
    return "C";
  }
  reasons.push("mapped_B_conservative_mid");
  return "B";
}
