export type TopologyCode = "SHARED" | "DEDICATED" | "ONPREM";

/** Allowed PlacementJob hops (ADR deployment-topology §5). */
export const ALLOWED_PLACEMENT_HOPS: ReadonlyArray<
  readonly [TopologyCode, TopologyCode]
> = [
  ["SHARED", "DEDICATED"],
  ["DEDICATED", "ONPREM"],
  ["ONPREM", "DEDICATED"],
  ["DEDICATED", "SHARED"],
] as const;

export function isDirectSharedOnpremHop(
  from: TopologyCode,
  to: TopologyCode,
): boolean {
  return (
    (from === "SHARED" && to === "ONPREM") ||
    (from === "ONPREM" && to === "SHARED")
  );
}

export function isAllowedPlacementHop(
  from: TopologyCode,
  to: TopologyCode,
): boolean {
  if (from === to) return false;
  return ALLOWED_PLACEMENT_HOPS.some(([a, b]) => a === from && b === to);
}

export const SHARED_ONPREM_REJECT_MESSAGE =
  "Direct SHARED ↔ ONPREM hop is forbidden. Use two hops via DEDICATED (SHARED→DEDICATED→ONPREM or reverse).";
