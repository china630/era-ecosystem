import { prisma } from "@/lib/prisma";
import { getClinicSettings } from "@/domain/settings/settings.service";
import { bakuDateKey, todayBakuYmd } from "@era/satellite-kit/time";
import { applyHotelVoidToExtra } from "@/domain/sanatorium/extras-assign.service";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";

export type StayProcedureStatus = "in_plan" | "arrived" | "no_show" | "completed" | "cancelled";

export type StayProcedureRow = {
  orderId: string;
  procedureName: string;
  amount: number;
  scheduledAt: string;
  status: StayProcedureStatus;
  folioRef: string | null;
  inPackage: boolean;
  /** Civil date of the session vs checkout day (Asia/Baku). */
  timing: "future" | "past" | "other";
};

function mapStatus(status: string): StayProcedureStatus {
  if (status === "CHECKED_IN") return "arrived";
  if (status === "NO_SHOW") return "no_show";
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "in_plan";
}

function timingOf(scheduledAt: Date, today: string): "future" | "past" | "other" {
  const day = bakuDateKey(scheduledAt);
  if (day > today) return "future";
  if (day < today) return "past";
  // Same calendar day: still ahead of check-out morning → treat as future to clear.
  return "future";
}

/** Paid extras and package sessions for one hotel reservation. Hotel does not store the plan. */
export async function listStayProceduresForCheckout(reservationId: string) {
  const id = reservationId.trim();
  const today = todayBakuYmd();
  const [orders, settings] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: { reservationId: id },
      orderBy: { scheduledAt: "asc" },
    }),
    getClinicSettings(),
  ]);
  const paid: StayProcedureRow[] = [];
  const unpaidExtras: StayProcedureRow[] = [];
  const packageSessions: StayProcedureRow[] = [];
  for (const order of orders) {
    const status = mapStatus(order.status);
    if (status === "completed" || status === "cancelled" || status === "arrived") continue;
    const row: StayProcedureRow = {
      orderId: order.id,
      procedureName: order.procedureName,
      amount: Number(order.amountNet),
      scheduledAt: order.scheduledAt.toISOString(),
      status,
      folioRef: order.extraTicketId,
      inPackage: order.inPackage,
      timing: timingOf(order.scheduledAt, today),
    };
    if (order.inPackage) {
      packageSessions.push(row);
      continue;
    }
    if (order.extraTicketId) {
      paid.push(row);
      continue;
    }
    if (order.status === "PENDING_PAY") {
      unpaidExtras.push(row);
    }
  }
  const futurePaid = paid.filter((row) => row.timing === "future" && row.status === "in_plan");
  const pastNoShowish = paid.filter(
    (row) => row.timing === "past" && (row.status === "in_plan" || row.status === "no_show"),
  );
  const futureUnpaid = unpaidExtras.filter((row) => row.timing === "future");
  const futurePackage = packageSessions.filter(
    (row) => row.timing === "future" && row.status === "in_plan",
  );
  return {
    paid,
    unpaidExtras,
    packageSessions,
    futurePaid,
    pastNoShowish,
    futureUnpaid,
    futurePackage,
    /** Desk still blocks only when clinic is unreachable mid-clear; futures clear at checkout. */
    blocksCheckout: false,
    noShowKeepsCharge: settings.noShowKeepsCharge,
    medical: true,
  };
}

/**
 * At hotel check-out: drop future extras (paid + unpaid) and future package seats.
 * Past no-shows: void when the house does not keep the charge.
 */
export async function clearStayProceduresAtCheckout(reservationId: string): Promise<{
  cancelledOrderIds: string[];
  keptNoShowOrderIds: string[];
}> {
  const snap = await listStayProceduresForCheckout(reservationId);
  const cancelledOrderIds: string[] = [];
  const keptNoShowOrderIds: string[] = [];

  const cancelRow = async (orderId: string) => {
    const result = await applyHotelVoidToExtra({ orderId });
    if (result.cancelled) cancelledOrderIds.push(orderId);
  };

  for (const row of [...snap.futurePaid, ...snap.futureUnpaid]) {
    await cancelRow(row.orderId);
  }

  for (const row of snap.futurePackage) {
    const order = await prisma.procedureOrder.findUnique({ where: { id: row.orderId } });
    if (!order) continue;
    if (["COMPLETED", "CHECKED_IN", "CANCELLED"].includes(order.status)) continue;
    if (order.status === "SCHEDULED" || order.status === "PROPOSED") {
      await releaseProcedureOccupancy([order.id]);
    }
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: "hotel_checkout_package_future",
      },
    });
    cancelledOrderIds.push(order.id);
  }

  for (const row of snap.pastNoShowish) {
    if (snap.noShowKeepsCharge) {
      keptNoShowOrderIds.push(row.orderId);
      continue;
    }
    await cancelRow(row.orderId);
  }

  return { cancelledOrderIds, keptNoShowOrderIds };
}
