export const HIGH_RISK_MCC = new Set(["7995", "6051", "6211"]);

export type CardLimits = {
  dailySpendLimitMinor?: number;
  atmDailyLimitMinor?: number;
  perTxnMaxMinor?: number;
};

export function parseCardLimits(limitsJson: unknown): CardLimits {
  if (!limitsJson || typeof limitsJson !== "object") return {};
  return limitsJson as CardLimits;
}

export function exceedsPerTxnLimit(amountMinor: bigint, limits: CardLimits): boolean {
  const max = limits.perTxnMaxMinor ?? limits.dailySpendLimitMinor;
  if (!max) return false;
  return amountMinor > BigInt(max);
}

export function isHighRiskMcc(mcc?: string | null): boolean {
  if (!mcc) return false;
  return HIGH_RISK_MCC.has(mcc.trim());
}

export function generateAuthCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
