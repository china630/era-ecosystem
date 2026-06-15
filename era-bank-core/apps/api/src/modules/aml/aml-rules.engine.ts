import { RiskRating } from "@era/bank-core-database";

export type RuleParams = {
  thresholdMinor?: number;
  windowHours?: number;
  limitMinor?: number;
  currencies?: string[];
};

export type TxnLegContext = {
  accountId?: string | null;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
};

export type RuleEvaluationContext = {
  transactionId: string;
  legs: TxnLegContext[];
  customerId?: string | null;
  customerRiskRating?: RiskRating | null;
  counterpartyIban?: string | null;
  recentTxnCountBelowThreshold?: number;
  velocity24hMinor?: bigint;
};

export function evaluateThresholdSingleTxn(
  ctx: RuleEvaluationContext,
  params: RuleParams,
): { hit: boolean; amountMinor?: bigint; currency?: string } {
  const threshold = BigInt(params.thresholdMinor ?? 1_500_000);
  for (const leg of ctx.legs) {
    if (leg.debitMinor >= threshold) {
      return { hit: true, amountMinor: leg.debitMinor, currency: leg.currency };
    }
  }
  return { hit: false };
}

export function evaluateVelocity24h(
  ctx: RuleEvaluationContext,
  params: RuleParams,
): boolean {
  const limit = BigInt(params.limitMinor ?? 5_000_000);
  return (ctx.velocity24hMinor ?? 0n) >= limit;
}

export function evaluateStructuring(
  ctx: RuleEvaluationContext,
  params: RuleParams,
): boolean {
  const threshold = BigInt(params.thresholdMinor ?? 1_500_000);
  const windowCount = ctx.recentTxnCountBelowThreshold ?? 0;
  return windowCount >= 3 && ctx.legs.some((l) => l.debitMinor > 0n && l.debitMinor < threshold);
}

export function evaluateHighRiskCustomer(ctx: RuleEvaluationContext): boolean {
  return ctx.customerRiskRating === RiskRating.HIGH && ctx.legs.some((l) => l.debitMinor > 0n);
}

export function evaluateCrossBorder(ctx: RuleEvaluationContext): boolean {
  const iban = ctx.counterpartyIban ?? "";
  if (!iban || iban.length < 2) return false;
  return !iban.toUpperCase().startsWith("AZ");
}

export function scoreSanctionMatch(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q || !t) return 0;
  if (q === t) return 100;
  if (t.includes(q) || q.includes(t)) return 85;
  if (q.includes("sanction") || t.includes("sanction")) return 95;
  return 10;
}
