import { prisma } from "@/lib/prisma";
import { getClinicSettings } from "@/domain/settings/settings.service";

export type StayProcedureStatus = "in_plan" | "arrived" | "no_show" | "completed" | "cancelled";

export type StayProcedureRow = {
  orderId: string;
  procedureName: string;
  amount: number;
  scheduledAt: string;
  status: StayProcedureStatus;
  folioRef: string | null;
  inPackage: boolean;
};

function mapStatus(status: string): StayProcedureStatus {
  if (status === "CHECKED_IN") return "arrived";
  if (status === "NO_SHOW") return "no_show";
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "in_plan";
}

/** Paid extras and package sessions for one hotel reservation. Hotel does not store the plan. */
export async function listStayProceduresForCheckout(reservationId: string) {
  const id = reservationId.trim();
  const [orders, settings] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: { reservationId: id },
      orderBy: { scheduledAt: "asc" },
    }),
    getClinicSettings(),
  ]);
  const paid: StayProcedureRow[] = [];
  const packageSessions: StayProcedureRow[] = [];
  for (const order of orders) {
    const row: StayProcedureRow = {
      orderId: order.id,
      procedureName: order.procedureName,
      amount: Number(order.amountNet),
      scheduledAt: order.scheduledAt.toISOString(),
      status: mapStatus(order.status),
      folioRef: order.extraTicketId,
      inPackage: order.inPackage,
    };
    if (order.extraTicketId && !order.inPackage) paid.push(row);
    else if (order.inPackage) packageSessions.push(row);
  }
  return {
    paid,
    packageSessions,
    blocksCheckout: paid.some((row) => row.status === "in_plan"),
    noShowKeepsCharge: settings.noShowKeepsCharge,
  };
}
