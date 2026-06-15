export type GapBucket = {
  dayOffset: number;
  inflowMinor: number;
  outflowMinor: number;
  netGapMinor: number;
  cumulativeGapMinor: number;
};

/** MVP liquidity gap buckets from day-offset inflow/outflow maps (minor units). */
export function buildGapBuckets(
  horizonDays: number,
  inflowsByDay: Map<number, bigint>,
  outflowsByDay: Map<number, bigint>,
): GapBucket[] {
  let cumulative = 0n;
  const buckets: GapBucket[] = [];
  for (let i = 0; i < horizonDays; i += 1) {
    const dayOffset = i + 1;
    const inflowMinor = inflowsByDay.get(dayOffset) ?? 0n;
    const outflowMinor = outflowsByDay.get(dayOffset) ?? 0n;
    const netGapMinor = inflowMinor - outflowMinor;
    cumulative += netGapMinor;
    buckets.push({
      dayOffset,
      inflowMinor: Number(inflowMinor),
      outflowMinor: Number(outflowMinor),
      netGapMinor: Number(netGapMinor),
      cumulativeGapMinor: Number(cumulative),
    });
  }
  return buckets;
}

export function computeLcrRatioStub(
  liquidAssetsMinor: bigint,
  netOutflows30dMinor: bigint,
): number | null {
  if (netOutflows30dMinor <= 0n) return null;
  return Number(liquidAssetsMinor) / Number(netOutflows30dMinor);
}

export function dayOffsetFrom(asOf: Date, target: Date): number {
  const msPerDay = 86400000;
  const diff = target.getTime() - asOf.getTime();
  return Math.max(1, Math.ceil(diff / msPerDay));
}
