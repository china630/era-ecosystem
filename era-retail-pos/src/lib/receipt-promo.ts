export type PromoInput = {
  promoCode?: string;
  discountPercent?: number;
};

const PROMO_CODES: Record<string, { percent?: number; fixed?: number }> = {
  SAVE10: { percent: 10 },
  HALF: { percent: 50 },
  "2FOR1": { percent: 50 },
};

export function resolvePromo(input: PromoInput, subtotal: number): {
  promoCode: string | null;
  discountPercent: number | null;
  discountAmount: number;
  amountNet: number;
} {
  const code = input.promoCode?.trim().toUpperCase();
  let percent = input.discountPercent;
  if (code && PROMO_CODES[code]) {
    percent = PROMO_CODES[code].percent ?? percent;
  }
  if (percent != null && (percent < 0 || percent > 100)) {
    throw new Error("discountPercent must be between 0 and 100");
  }
  const discountAmount =
    percent != null ? Math.round(subtotal * (percent / 100) * 100) / 100 : 0;
  const amountNet = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  return {
    promoCode: code ?? null,
    discountPercent: percent ?? null,
    discountAmount,
    amountNet,
  };
}

export function recalcReceiptTotals(
  lineTotals: number[],
  promo: { discountPercent?: number | null; discountAmount?: number },
): { subtotal: number; discountAmount: number; amountNet: number } {
  const subtotal = lineTotals.reduce((s, n) => s + n, 0);
  let discountAmount = Number(promo.discountAmount ?? 0);
  if (promo.discountPercent != null) {
    discountAmount = Math.round(subtotal * (Number(promo.discountPercent) / 100) * 100) / 100;
  }
  const amountNet = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  return { subtotal, discountAmount, amountNet };
}
