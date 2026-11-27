/** Same rules as era-clinic/src/domain/procedure/board-display-time.ts */
export function boardOccupancyDisplay(order: {
  status: string;
  schedulingMode?: string | null;
  resourceId?: string | null;
  hasResource?: boolean;
  scheduledAt: string;
  endsAt?: string | null;
  actualStartsAt?: string | null;
  actualEndsAt?: string | null;
  effectiveEndsAt?: string | null;
}): {
  openUnseated: boolean;
  startIso: string;
  endIso: string | null;
  kind: "plan" | "actual" | "open";
} {
  const openUnseated =
    order.schedulingMode === "OPEN" &&
    !order.resourceId &&
    !order.hasResource &&
    order.status === "SCHEDULED";
  if (openUnseated) {
    return {
      openUnseated: true,
      startIso: order.scheduledAt,
      endIso: null,
      kind: "open",
    };
  }
  const useActual =
    (order.status === "CHECKED_IN" || order.status === "COMPLETED") &&
    Boolean(order.actualStartsAt);
  if (useActual) {
    return {
      openUnseated: false,
      startIso: order.actualStartsAt!,
      endIso: order.actualEndsAt ?? null,
      kind: "actual",
    };
  }
  return {
    openUnseated: false,
    startIso: order.scheduledAt,
    endIso: order.endsAt || order.effectiveEndsAt || null,
    kind: "plan",
  };
}
