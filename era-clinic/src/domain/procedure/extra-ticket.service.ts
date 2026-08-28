import { prisma } from "@/lib/prisma";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { resolveProcedureCharge } from "@/domain/procedure/procedure-charge.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { postHotelElektrawebOutbox } from "@/lib/elektraweb-outbox-client";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import {
  getClinicHotelOrganizationId,
  resolveClinicCutoverOrgId,
} from "@/domain/physio/clinic-cutover.service";
import {
  extraNeedsPaperTicket,
  extraTicketIdForOrder,
  isClinicElektrawebDualRun,
} from "@/domain/procedure/extra-ticket";

export async function listExtrasAwaitingTicket(organizationId?: string | null) {
  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });
  const dualRun = await isClinicElektrawebDualRun(orgId);
  const orders = await prisma.procedureOrder.findMany({
    where: {
      extraTicketIssuedAt: null,
      importedHistorical: false,
      status: { in: ["PROPOSED", "SCHEDULED"] },
      amountNet: { gt: 0 },
    },
    include: { patientRef: true },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
  return { dualRun, orders };
}

export async function issueExtraTickets(
  orderIds: string[],
  actorUserId: string,
  organizationId?: string | null,
) {
  if (!orderIds.length) {
    throw new ProcedureAttendanceError("No procedures selected", "INVALID_TRANSITION");
  }
  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });
  const dualRun = await isClinicElektrawebDualRun(orgId);
  const hotelOrganizationId = dualRun
    ? await getClinicHotelOrganizationId(orgId)
    : null;
  if (dualRun && !hotelOrganizationId) {
    throw new ProcedureAttendanceError(
      "Clinic cutover policy missing hotelOrganizationId",
      "INVALID_TRANSITION",
    );
  }
  const issued = [];

  for (const orderId of orderIds) {
    const order = await prisma.procedureOrder.findUnique({
      where: { id: orderId },
      include: { patientRef: true },
    });
    if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
    if (order.extraTicketIssuedAt) {
      issued.push(order);
      continue;
    }
    if (order.importedHistorical) continue;
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(order.status)) {
      throw new ProcedureAttendanceError(
        `Cannot issue ticket from status ${order.status}`,
        "INVALID_TRANSITION",
      );
    }

    const charge = await resolveProcedureCharge(order, { burnQuota: false });
    if (!extraNeedsPaperTicket({ amountNet: charge.amountNet })) {
      continue;
    }

    const ticketId = extraTicketIdForOrder(order.id);
    const description = charge.overQuota
      ? `Over-quota ${order.procedureName}`
      : order.procedureName;

    if (dualRun && hotelOrganizationId) {
      await postHotelElektrawebOutbox({
        hotelOrganizationId,
        idempotencyKey: ticketId,
        patientOrigin: order.patientOrigin === "IN_HOUSE" ? "IN_HOUSE" : "WALK_IN",
        reservationId: order.reservationId,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        amount: charge.amountNet,
        description,
      });
    } else {
      const billingTarget = await resolveBillingTarget(order.patientOrigin);
      if (billingTarget === "HOTEL_FOLIO" && order.reservationId) {
        await postHotelRoomCharge({
          reservationId: order.reservationId,
          amount: charge.amountNet,
          description,
          externalTicketId: ticketId,
        });
      }
    }

    const updated = await prisma.procedureOrder.update({
      where: { id: order.id },
      data: {
        extraTicketIssuedAt: new Date(),
        extraTicketId: ticketId,
        amountNet: charge.amountNet,
      },
      include: { patientRef: true },
    });
    await recordClinicAudit(
      { userId: actorUserId },
      "ProcedureOrder",
      order.id,
      "EXTRA_TICKET_ISSUED",
      { ticketId, dualRun, amountNet: charge.amountNet, hotelOrganizationId },
    );
    issued.push(updated);
  }

  const ticketId = issued[0]?.extraTicketId ?? extraTicketIdForOrder(orderIds[0]!);
  return {
    dualRun,
    ticketId,
    printPaths: issued
      .map((row) => row.extraTicketId)
      .filter((id): id is string => Boolean(id))
      .map((id) => `/print/extra-ticket/${id}?autoprint=1`),
    orders: issued,
  };
}

export async function loadExtraTicketPrint(ticketId: string) {
  // Skip filter briefly to resolve ticket org, then enter ALS for the load.
  const prev = process.env.ERA_SKIP_TENANT_FILTER;
  process.env.ERA_SKIP_TENANT_FILTER = "1";
  let organizationId: string | undefined;
  try {
    const probe = await prisma.procedureOrder.findFirst({
      where: { extraTicketId: ticketId },
      select: { organizationId: true },
    });
    organizationId = probe?.organizationId;
  } finally {
    if (prev === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prev;
  }
  if (!organizationId) return [];
  const { enterRequestTenant } = await import("@/lib/request-organization");
  enterRequestTenant(organizationId);
  const orders = await prisma.procedureOrder.findMany({
    where: { extraTicketId: ticketId, organizationId },
    include: { patientRef: true },
  });
  return orders;
}
