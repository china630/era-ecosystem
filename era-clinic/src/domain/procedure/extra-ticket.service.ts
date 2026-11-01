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

export type ExtraTicketListRow = {
  id: string;
  kind: "procedure" | "lab" | "visit";
  procedureCode: string;
  procedureName: string;
  amountNet: number;
  patientOrigin: string;
  scheduledAt: Date;
  resourceId: string | null;
  patientRefId: string;
  patientRef: { fullName: string; refCode: string };
  clinicalEpisodeId: string | null;
  clinicalEpisode: { roomNumber: string | null } | null;
  status: string;
  extraTicketIssuedAt: Date | null;
};

function diagnosticTitle(
  locale: string | null | undefined,
  svc:
    | { titleAz: string | null; titleRu: string | null; titleEn: string | null }
    | null
    | undefined,
  fallback: string,
): string {
  const loc = (locale || "az").slice(0, 2).toLowerCase();
  const az = svc?.titleAz?.trim() || "";
  const ru = svc?.titleRu?.trim() || "";
  const en = svc?.titleEn?.trim() || "";
  if (loc === "ru") return ru || az || en || fallback;
  if (loc === "en") return en || az || ru || fallback;
  return az || ru || en || fallback;
}

export async function listExtrasAwaitingTicket(
  organizationId?: string | null,
  filter?: { room?: string | null; q?: string | null; locale?: string | null },
): Promise<{
  dualRun: boolean;
  orders: ExtraTicketListRow[];
  needsFilter: boolean;
}> {
  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });
  const dualRun = await isClinicElektrawebDualRun(orgId);
  const room = filter?.room?.trim() ?? "";
  const q = filter?.q?.trim() ?? "";
  const locale = filter?.locale ?? "az";
  if (!room && !q) {
    return { dualRun, orders: [], needsFilter: true };
  }
  const { start } = bakuDayBounds(todayBakuYmd());
  const roomFilter = room ? { clinicalEpisode: { roomNumber: room } } : {};
  const qMode = "insensitive" as const;
  const patientNameQ = q
    ? [
        { patientRef: { fullName: { contains: q, mode: qMode } } },
        { patientRef: { refCode: { contains: q, mode: qMode } } },
      ]
    : [];

  const [procedures, labs, visits] = await Promise.all([
    prisma.procedureOrder.findMany({
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
        ...roomFilter,
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { procedureName: { contains: q, mode: qMode } },
                    { procedureCode: { contains: q, mode: qMode } },
                    ...patientNameQ,
                  ],
                },
              ],
            }
          : {}),
      },
      include: { patientRef: true, clinicalEpisode: { select: { roomNumber: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.labOrder.findMany({
      where: {
        amountNet: { gt: 0 },
        settledAt: null,
        inPackage: false,
        status: { not: "CANCELLED" },
        ...(room
          ? {
              AND: [
                {
                  OR: [
                    { roomNumber: room },
                    { episode: { roomNumber: room } },
                  ],
                },
              ],
            }
          : {}),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    ...patientNameQ,
                    { testCode: { contains: q, mode: qMode } },
                    { items: { some: { serviceCode: { contains: q, mode: qMode } } } },
                    {
                      items: {
                        some: {
                          diagnosticService: {
                            OR: [
                              { titleAz: { contains: q, mode: qMode } },
                              { titleRu: { contains: q, mode: qMode } },
                              { titleEn: { contains: q, mode: qMode } },
                              { code: { contains: q, mode: qMode } },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      include: {
        patientRef: true,
        episode: { select: { roomNumber: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: {
            diagnosticService: {
              select: { titleAz: true, titleRu: true, titleEn: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.visit.findMany({
      where: {
        amountNet: { gt: 0 },
        settledAt: null,
        status: { not: "CANCELLED" },
        NOT: { serviceLines: { some: { inPackage: true } } },
        ...(room
          ? {
              AND: [
                {
                  OR: [
                    { roomNumber: room },
                    { clinicalEpisode: { roomNumber: room } },
                  ],
                },
              ],
            }
          : {}),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    ...patientNameQ,
                    {
                      serviceLines: {
                        some: {
                          OR: [
                            { serviceCode: { contains: q, mode: qMode } },
                            { description: { contains: q, mode: qMode } },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      include: {
        patientRef: true,
        clinicalEpisode: { select: { roomNumber: true } },
        serviceLines: { orderBy: { id: "asc" }, take: 1 },
        appointment: { select: { scheduledAt: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const orders: ExtraTicketListRow[] = [
    ...procedures.map((o) => ({
      id: o.id,
      kind: "procedure" as const,
      procedureCode: o.procedureCode,
      procedureName: o.procedureName,
      amountNet: Number(o.amountNet),
      patientOrigin: o.patientOrigin,
      scheduledAt: o.scheduledAt,
      resourceId: o.resourceId,
      patientRefId: o.patientRefId,
      patientRef: o.patientRef,
      clinicalEpisodeId: o.clinicalEpisodeId ?? null,
      clinicalEpisode: o.clinicalEpisode,
      status: o.status,
      extraTicketIssuedAt: o.extraTicketIssuedAt,
    })),
    ...labs.map((o) => {
      const svc = o.items[0]?.diagnosticService;
      const code = o.items[0]?.serviceCode || o.testCode;
      return {
        id: o.id,
        kind: "lab" as const,
        procedureCode: code,
        procedureName: diagnosticTitle(locale, svc, code),
        amountNet: Number(o.amountNet),
        patientOrigin: o.patientOrigin ?? "IN_HOUSE",
        scheduledAt: o.scheduledCollectionAt ?? o.createdAt,
        resourceId: null,
        patientRefId: o.patientRefId,
        patientRef: o.patientRef,
        clinicalEpisodeId: o.clinicalEpisodeId ?? null,
        clinicalEpisode: o.episode,
        status: "AWAITING_PAYMENT",
        extraTicketIssuedAt: null,
      };
    }),
    ...visits.map((v) => {
      const line = v.serviceLines[0];
      return {
        id: v.id,
        kind: "visit" as const,
        procedureCode: line?.serviceCode ?? "VISIT",
        procedureName: line?.description || line?.serviceCode || "VISIT",
        amountNet: Number(v.amountNet),
        patientOrigin: v.patientOrigin ?? "IN_HOUSE",
        scheduledAt: v.appointment?.scheduledAt ?? v.createdAt,
        resourceId: null,
        patientRefId: v.patientRefId,
        patientRef: v.patientRef,
        clinicalEpisodeId: v.clinicalEpisodeId ?? null,
        clinicalEpisode: v.clinicalEpisode,
        status: "AWAITING_PAYMENT",
        extraTicketIssuedAt: null,
      };
    }),
  ].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return { dualRun, orders, needsFilter: false };
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
