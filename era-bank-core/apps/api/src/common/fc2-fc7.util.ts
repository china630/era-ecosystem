import { BadRequestException } from "@nestjs/common";
import {
  CardDisputeStatus,
  ForbearanceStage,
  ProductKind,
} from "@era/bank-core-database";

/** Lab 3DS challenge threshold — amounts above require completed 3DS. */
export const THREE_DS_THRESHOLD_MINOR = 500_000n;

export const SWIFT_MT_TYPES = [
  "MT700",
  "MT701",
  "MT707",
  "MT710",
  "MT720",
  "MT740",
  "MT747",
  "MT750",
  "MT752",
  "MT754",
  "MT756",
  "MT760",
  "MT767",
  "MT799",
] as const;

export type CreditPolicyRulesJson = {
  minScoreApprove?: number;
  minScoreReview?: number;
  pepAutoReview?: boolean;
  maxRequestedMinor?: number;
};

export type ScoreDecision = {
  score: number;
  decision: "APPROVE" | "REVIEW" | "DECLINE";
  reasonCodes: string[];
  rulesApplied: CreditPolicyRulesJson;
};

const FORBEARANCE_ORDER: ForbearanceStage[] = [
  ForbearanceStage.NONE,
  ForbearanceStage.WATCH,
  ForbearanceStage.PAYMENT_HOLIDAY,
  ForbearanceStage.TERM_EXTENSION,
  ForbearanceStage.RESTRUCTURE,
];

export function assertForbearanceTransition(
  from: ForbearanceStage,
  to: ForbearanceStage,
): void {
  if (from === to) return;
  const fromIdx = FORBEARANCE_ORDER.indexOf(from);
  const toIdx = FORBEARANCE_ORDER.indexOf(to);
  if (toIdx < fromIdx) {
    throw new BadRequestException(
      `Forbearance stage cannot regress from ${from} to ${to}`,
    );
  }
  if (toIdx > fromIdx + 1) {
    throw new BadRequestException(
      `Forbearance stage must advance one step at a time (${from} → ${to})`,
    );
  }
}

const DISPUTE_TRANSITIONS: Record<CardDisputeStatus, CardDisputeStatus[]> = {
  [CardDisputeStatus.OPEN]: [CardDisputeStatus.UNDER_REVIEW, CardDisputeStatus.WRITTEN_OFF],
  [CardDisputeStatus.UNDER_REVIEW]: [
    CardDisputeStatus.WON,
    CardDisputeStatus.LOST,
    CardDisputeStatus.WRITTEN_OFF,
  ],
  [CardDisputeStatus.WON]: [],
  [CardDisputeStatus.LOST]: [],
  [CardDisputeStatus.WRITTEN_OFF]: [],
};

export function assertDisputeTransition(
  from: CardDisputeStatus,
  to: CardDisputeStatus,
): void {
  if (from === to) return;
  const allowed = DISPUTE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `Invalid dispute transition: ${from} → ${to}`,
    );
  }
}

export function applyCreditPolicy(input: {
  bureauScore: number;
  rules: CreditPolicyRulesJson;
  pepFlag?: boolean;
  requestedMinor?: bigint;
}): ScoreDecision {
  const rules = input.rules;
  const minApprove = rules.minScoreApprove ?? 600;
  const minReview = rules.minScoreReview ?? 500;
  const reasonCodes: string[] = [];
  let decision: ScoreDecision["decision"];

  if (input.bureauScore < minReview) {
    decision = "DECLINE";
    reasonCodes.push("LOW_SCORE");
  } else if (input.bureauScore < minApprove) {
    decision = "REVIEW";
    reasonCodes.push("LOW_SCORE");
  } else {
    decision = "APPROVE";
  }

  if (input.pepFlag && rules.pepAutoReview !== false) {
    if (decision === "APPROVE") decision = "REVIEW";
    if (!reasonCodes.includes("PEP_FLAG")) reasonCodes.push("PEP_FLAG");
  }

  if (
    rules.maxRequestedMinor != null &&
    input.requestedMinor != null &&
    input.requestedMinor > BigInt(rules.maxRequestedMinor)
  ) {
    if (decision === "APPROVE") decision = "REVIEW";
    reasonCodes.push("AMOUNT_ABOVE_POLICY");
  }

  return {
    score: input.bureauScore,
    decision,
    reasonCodes,
    rulesApplied: rules,
  };
}

export function computeMlScorePlaceholder(input: {
  pepFlag: boolean;
  riskRating: string;
  alertCount30d: number;
}): number {
  let score = 10;
  if (input.pepFlag) score += 40;
  if (input.riskRating === "HIGH") score += 30;
  else if (input.riskRating === "MEDIUM") score += 15;
  score += Math.min(30, input.alertCount30d * 5);
  return Math.min(100, score);
}

export function computeIrrbbGapMinor(
  inputs: Array<{ bucketKey: string; amountMinor: bigint; rateBps: number }>,
  shockBps = 200,
): { gapMinor: bigint; shockedPnlMinor: bigint; buckets: Array<{ bucketKey: string; amountMinor: string; deltaMinor: string }> } {
  let gapMinor = 0n;
  let shockedPnlMinor = 0n;
  const buckets = inputs.map((row) => {
    const delta = BigInt(
      Math.round(Number(row.amountMinor) * (shockBps / 10_000)),
    );
    gapMinor += row.amountMinor;
    shockedPnlMinor += delta;
    return {
      bucketKey: row.bucketKey,
      amountMinor: row.amountMinor.toString(),
      deltaMinor: delta.toString(),
    };
  });
  return { gapMinor, shockedPnlMinor, buckets };
}

export function computeOpRiskCapitalAddonMinor(
  events: Array<{ amountMinor: bigint; category: string }>,
): { addonMinor: bigint; byCategory: Record<string, string> } {
  const byCategory: Record<string, bigint> = {};
  for (const ev of events) {
    const weight = ev.category === "FRAUD" ? 150n : 100n;
    const addon = (ev.amountMinor * weight) / 100n;
    byCategory[ev.category] = (byCategory[ev.category] ?? 0n) + addon;
  }
  const addonMinor = Object.values(byCategory).reduce((s, v) => s + v, 0n);
  return {
    addonMinor,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, v.toString()]),
    ),
  };
}

export function productParamHints(kind: ProductKind): string[] {
  switch (kind) {
    case ProductKind.STRUCTURED_DEPOSIT:
      return ["indexLinkKey (required)", "rateType FLOATING recommended", "indexKey + spreadBps"];
    case ProductKind.CALL_DEPOSIT:
      return ["callNoticeDays (required, ≥1)", "termMonths as max notice window"];
    case ProductKind.LOAN_MORTGAGE:
      return ["collateralFlag: true (required)", "glAssetCode / glInterestIncomeCode"];
    case ProductKind.LOAN_LEASE:
      return ["assetRef (required in contract origination)", "glAssetCode"];
    case ProductKind.LOAN_FACTORING:
      return ["invoiceRef (required in contract origination)", "glAssetCode"];
    case ProductKind.LOAN_MFI:
      return ["groupId optional in paramsJson", "shorter termMonths band"];
    case ProductKind.LOAN_SYNDICATED:
      return ["participationPct in paramsJson (0–100)", "leadBankName on credit line"];
    case ProductKind.LOAN_PROJECT:
      return ["projectRef (required in contract origination)", "drawdown milestones via credit line"];
    case ProductKind.LOAN_TRADE:
      return ["packingCreditRef / tradeRef on origination", "links to trade LC/BG"];
    default:
      return [];
  }
}

export function validateKindSpecificParams(
  kind: ProductKind,
  obj: Record<string, unknown>,
): void {
  switch (kind) {
    case ProductKind.STRUCTURED_DEPOSIT:
      if (!obj.indexLinkKey || typeof obj.indexLinkKey !== "string") {
        throw new BadRequestException(
          "STRUCTURED_DEPOSIT requires paramsJson.indexLinkKey",
        );
      }
      break;
    case ProductKind.CALL_DEPOSIT: {
      const days = obj.callNoticeDays;
      if (typeof days !== "number" || !Number.isInteger(days) || days < 1) {
        throw new BadRequestException(
          "CALL_DEPOSIT requires paramsJson.callNoticeDays (positive integer)",
        );
      }
      break;
    }
    case ProductKind.LOAN_MORTGAGE:
      if (obj.collateralFlag !== true) {
        throw new BadRequestException(
          "LOAN_MORTGAGE requires paramsJson.collateralFlag=true",
        );
      }
      break;
    case ProductKind.LOAN_LEASE:
      if (!obj.assetRefTemplate || typeof obj.assetRefTemplate !== "string") {
        throw new BadRequestException(
          "LOAN_LEASE requires paramsJson.assetRefTemplate",
        );
      }
      break;
    case ProductKind.LOAN_FACTORING:
      if (!obj.invoiceRefTemplate || typeof obj.invoiceRefTemplate !== "string") {
        throw new BadRequestException(
          "LOAN_FACTORING requires paramsJson.invoiceRefTemplate",
        );
      }
      break;
    case ProductKind.LOAN_SYNDICATED: {
      const pct = obj.participationPct;
      if (typeof pct !== "number" || pct <= 0 || pct > 100) {
        throw new BadRequestException(
          "LOAN_SYNDICATED requires paramsJson.participationPct in (0, 100]",
        );
      }
      break;
    }
    case ProductKind.LOAN_PROJECT:
      if (!obj.projectRefTemplate || typeof obj.projectRefTemplate !== "string") {
        throw new BadRequestException(
          "LOAN_PROJECT requires paramsJson.projectRefTemplate",
        );
      }
      break;
    case ProductKind.LOAN_TRADE:
      if (!obj.packingCreditRefTemplate || typeof obj.packingCreditRefTemplate !== "string") {
        throw new BadRequestException(
          "LOAN_TRADE requires paramsJson.packingCreditRefTemplate",
        );
      }
      break;
    default:
      break;
  }
}
