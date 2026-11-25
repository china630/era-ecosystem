import { RiskRating } from "@era/bank-core-database";

/** 15 000 AZN at 2 decimal minor units (×100). */
export const THRESHOLD_SINGLE_TXN_DEFAULT_MINOR = 1_500_000;

/** 20 000 AZN cash FMN reporting threshold (×100 minor). */
export const CASH_THRESHOLD_DEFAULT_MINOR = 2_000_000;

/** Article 7 / SFm: large cash ops — file within T+3 business days (scaffold). */
export const CASH_FMN_FILING_BUSINESS_DAYS = 3;

export type RuleParams = {
  thresholdMinor?: number;
  windowHours?: number;
  limitMinor?: number;
  currencies?: string[];
  filingBusinessDays?: number;
  cashVaultGlAccountIds?: string[];
};

export type TxnLegContext = {
  accountId?: string | null;
  glAccountId?: string;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
};

export type RuleEvaluationContext = {
  transactionId: string;
  txnType?: string | null;
  reference?: string | null;
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
  const threshold = BigInt(params.thresholdMinor ?? THRESHOLD_SINGLE_TXN_DEFAULT_MINOR);
  for (const leg of ctx.legs) {
    if (leg.debitMinor >= threshold) {
      return { hit: true, amountMinor: leg.debitMinor, currency: leg.currency };
    }
  }
  return { hit: false };
}

export function isCashTellerTransaction(
  ctx: RuleEvaluationContext,
  params: RuleParams,
): boolean {
  const txnType = (ctx.txnType ?? "").toUpperCase();
  if (txnType !== "DEPOSIT" && txnType !== "WITHDRAWAL") return false;

  const ref = ctx.reference ?? "";
  if (ref.startsWith("CASH-IN-") || ref.startsWith("CASH-OUT-")) return true;

  const vaultIds = new Set(params.cashVaultGlAccountIds ?? []);
  if (vaultIds.size > 0) {
    return ctx.legs.some((leg) => leg.glAccountId && vaultIds.has(leg.glAccountId));
  }

  return false;
}

function txnCashAmountMinor(ctx: RuleEvaluationContext): { amountMinor: bigint; currency?: string } {
  let max = 0n;
  let currency: string | undefined;
  for (const leg of ctx.legs) {
    const legMax = leg.debitMinor > leg.creditMinor ? leg.debitMinor : leg.creditMinor;
    if (legMax > max) {
      max = legMax;
      currency = leg.currency;
    }
  }
  return { amountMinor: max, currency };
}

function currencyAllowed(currency: string, params: RuleParams): boolean {
  const allowed = params.currencies ?? ["AZN"];
  return allowed.includes(currency);
}

export function evaluateCashThreshold(
  ctx: RuleEvaluationContext,
  params: RuleParams,
): { hit: boolean; amountMinor?: bigint; currency?: string } {
  if (!isCashTellerTransaction(ctx, params)) return { hit: false };

  const threshold = BigInt(params.thresholdMinor ?? CASH_THRESHOLD_DEFAULT_MINOR);
  const { amountMinor, currency } = txnCashAmountMinor(ctx);
  if (amountMinor < threshold) return { hit: false };
  if (currency && !currencyAllowed(currency, params)) return { hit: false };

  return { hit: true, amountMinor, currency };
}

/** Weekend-only business-day add (calendar service wired at service layer later). */
export function addBusinessDaysSync(from: Date, businessDays: number): Date {
  let cursor = new Date(from.getTime());
  let added = 0;
  while (added < businessDays) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return cursor;
}

export function computeCashFmnFilingDeadline(
  observedAt: Date,
  filingBusinessDays = CASH_FMN_FILING_BUSINESS_DAYS,
): Date {
  return addBusinessDaysSync(observedAt, filingBusinessDays);
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
  const threshold = BigInt(params.thresholdMinor ?? THRESHOLD_SINGLE_TXN_DEFAULT_MINOR);
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