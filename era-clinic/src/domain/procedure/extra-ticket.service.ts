import { prisma } from "@/lib/prisma";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import {
  postProcedureFolioCharge,
  resolveProcedureCharge,
} from "@/domain/procedure/procedure-charge.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  getClinicHotelOrganizationId,
  resolveClinicCutoverOrgId,
} from "@/domain/physio/clinic-cutover.service";
import {
  extraNeedsPaperTicket,
  extraTicketIdForOrder,
  extraTicketPrintPath,
  isClinicElektrawebDualRun,
} from "@/domain/procedure/extra-ticket";
import { enterRequestTenant } from "@/lib/request-organization";
import { loadCatalogDisplayNameMap } from "@/domain/catalog/catalog-display-name.service";

export async function listExtrasAwaitingTicket(
  organizationId?: string | null,
  filter?: { room?: string | null; q?: string | null },
) {
  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });
  const dualRun = await isClinicElektrawebDualRun(orgId);
  const room = filter?.room?.trim() ?? "";
  const q = filter?.q?.trim() ?? "";
  if (!room && !q) {
    return { dualRun, orders: [], needsFilter: true as const };
  }
  const { start } = bakuDayBounds(todayBakuYmd());
  const orders = await prisma.procedureOrder.findMany({
    where: {
      extraTicketIssuedAt: null,
      importedHistorical: false,
      scheduledAt: { gte: start },
      OR: [
        { status: "PENDING_PAY" },
        {
          status: { in: ["PROPOSED", "SCHEDULED"] },
          amountNet: { gt: 0 },
        },
      ],
      ...(room
        ? { clinicalEpisode: { roomNumber: room } }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { procedureName: { contains: q, mode: "insensitive" } },
                  { patientRef: { fullName: { contains: q, mode: "insensitive" } } },
                  { patientRef: { refCode: { contains: q, mode: "insensitive" } } },
                ],
              },
            ],
          }
        : {}),
    },
    include: { patientRef: true, clinicalEpisode: { select: { roomNumber: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  return { dualRun, orders, needsFilter: false as const };
}

export async function issueExtraTickets(
  orderIds: string[],
  actorUserId: string,
  organizationId?: string | null,
  locale?: string | null,
) {
  if (!orderIds.length) {
    throw new ProcedureAttendanceError("No procedures selected", "INVALID_TRANSITION");
  }
  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });
  const selected = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds } },
    select: { patientRefId: true, procedureCode: true },
  });
  const patientIds = new Set(selected.map((order) => order.patientRefId));
  if (patientIds.size > 1) {
    throw new ProcedureAttendanceError("One cheque is one patient", "MIXED_PATIENT");
  }
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
  const catalogNames = await loadCatalogDisplayNameMap(
    selected.map((row) => row.procedureCode),
    locale || "az",
  );

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
    const procedureLabel = catalogNames.get(order.procedureCode) || order.procedureName;
    const description = charge.overQuota
      ? `Over-quota ${procedureLabel}`
      : procedureLabel;

    if (order.patientOrigin === "IN_HOUSE" && !order.reservationId) {
      throw new ProcedureAttendanceError(
        "In-house extra needs a hotel reservation before the folio charge",
        "INVALID_TRANSITION",
      );
    }
    if (order.reservationId && charge.amountNet > 0) {
      await postProcedureFolioCharge({
        hotelOrganizationId: hotelOrganizationId ?? undefined,
        reservationId: order.reservationId,
        amount: charge.amountNet,
        description,
        externalTicketId: ticketId,
        procedureCode: order.procedureCode,
        qty: order.quantity,
      });
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
      .map((id) => extraTicketPrintPath(id, orgId)),
    orders: issued,
  };
}

const printInclude = {
  patientRef: true,
  clinicalEpisode: { select: { roomNumber: true } },
} as const;

export async function loadExtraTicketPrint(ticketId: string, organizationId: string) {
  const orgId = organizationId.trim();
  if (!orgId) return [];
  enterRequestTenant(orgId);
  const seed = await prisma.procedureOrder.findMany({
    where: { extraTicketId: ticketId },
    include: printInclude,
    orderBy: { createdAt: "asc" },
  });
  const receipt = seed.find((row) => row.paymentReceiptRef?.trim())?.paymentReceiptRef?.trim();
  const patientRefId = seed[0]?.patientRefId;
  if (!receipt || !patientRefId) {
    return seed.filter((row) => row.status !== "CANCELLED" && row.status !== "UNPAID_MISSED");
  }
  const rows = await prisma.procedureOrder.findMany({
    where: { paymentReceiptRef: receipt, patientRefId },
    include: printInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((row) => row.status !== "CANCELLED" && row.status !== "UNPAID_MISSED");
}
