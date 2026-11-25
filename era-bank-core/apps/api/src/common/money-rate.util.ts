/**
 * Apply a decimal rate to a money amount without coercing the amount through Number().
 * Rate may still be a JS number (product param); amount stays bigint.
 */
export function mulRateRound(
  amountMinor: bigint,
  rate: number,
  scale = 1_000_000_000,
): bigint {
  if (amountMinor <= 0n || !(rate > 0) || !Number.isFinite(rate)) return 0n;
  const den = BigInt(scale);
  const rateScaled = BigInt(Math.round(rate * scale));
  if (rateScaled <= 0n) return 0n;
  return (amountMinor * rateScaled + den / 2n) / den;
}

/** Coverage ratio in [0, 1] as fraction of SCALE (avoids Number(amount)). */
export function coverageRatioScaled(
  numeratorMinor: bigint,
  denominatorMinor: bigint,
  scale = 1_000_000n,
): bigint {
  if (denominatorMinor <= 0n || numeratorMinor <= 0n) return 0n;
  return (numeratorMinor * scale) / denominatorMinor;
}
