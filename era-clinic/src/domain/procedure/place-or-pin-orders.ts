/**
 * CLI-62 — place FIXED on cabin grid; pin OPEN as day-buckets (no cabin).
 */
import { prisma } from "@/lib/prisma";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
import { pinOpenAttendanceOrders } from "@/domain/procedure/open-attendance";

export type PlaceOrPinOpts = {
  confirmedByUserId?: string;
  scheduleBefore?: Date;
  startAt?: Date;
  pinYmdByOrderId?: Record<string, string>;
  pinStrict?: boolean;
  atomic?: boolean;
};

export type PlaceOrPinResult = {
  placed: number;
  placedIds: string[];
  missingCabinNames: string[];
  failures: Array<{
    orderId: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    ymd?: string;
  }>;
};

export async function placeOrPinOrders(
  orderIds: string[],
  opts?: PlaceOrPinOpts,
): Promise<PlaceOrPinResult> {
  if (orderIds.length === 0) {
    return { placed: 0, placedIds: [], missingCabinNames: [], failures: [] };
  }
  const rows = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, schedulingMode: true },
  });
  const openIds = rows.filter((r) => r.schedulingMode === "OPEN").map((r) => r.id);
  const fixedIds = rows.filter((r) => r.schedulingMode !== "OPEN").map((r) => r.id);

  const out: PlaceOrPinResult = {
    placed: 0,
    placedIds: [],
    missingCabinNames: [],
    failures: [],
  };

  if (openIds.length > 0) {
    const open = await pinOpenAttendanceOrders(openIds, {
      confirmedByUserId: opts?.confirmedByUserId,
      scheduleBefore: opts?.scheduleBefore,
      startAt: opts?.startAt,
      pinYmdByOrderId: opts?.pinYmdByOrderId,
    });
    out.placed += open.placed;
    out.placedIds.push(...open.placedIds);
    out.failures.push(...open.failures);
  }
  if (fixedIds.length > 0) {
    const fixed = await placeConfirmedProcedures(fixedIds, {
      confirmedByUserId: opts?.confirmedByUserId,
      scheduleBefore: opts?.scheduleBefore,
      startAt: opts?.startAt,
      pinYmdByOrderId: opts?.pinYmdByOrderId,
      pinStrict: opts?.pinStrict,
      atomic: opts?.atomic,
    });
    out.placed += fixed.placed;
    out.placedIds.push(...fixed.placedIds);
    out.missingCabinNames.push(...fixed.missingCabinNames);
    out.failures.push(...fixed.failures);
  }
  return out;
}
