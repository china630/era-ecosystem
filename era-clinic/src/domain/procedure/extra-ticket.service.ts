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
  classifyExtraListBucket,
  dueDeskKeepsIssuedToday,
  extraListBucketMatches,
  extraNeedsPaperTicket,
  extraTicketIdForOrder,
  extraTicketPrintPath,
  isClinicElektrawebDualRun,
  type ExtraListBucket,
  type ExtraListScope,
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
  extraTicketId: string | null;
  bucket: ExtraListBucket;
  printPath: string | null;
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
  filter?: {
    room?: string | null;
    q?: string | null;
    locale?: string | null;
    scope?: ExtraListScope | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  },
): Promise<{
  dualRun: boolean;
  orders: ExtraTicketListRow[];
  needsFilter: boolean;
  needsDates: boolean;
  scope: ExtraListScope;
}> {
  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });
  const dualRun = await isClinicElektrawebDualRun(orgId);
  const room = filter?.room?.trim() ?? "";
  const q = filter?.q?.trim() ?? "";
  const locale = filter?.locale ?? "az";
  const scope: ExtraListScope = filter?.scope ?? "due";
  if (!room && !q) {
    return { dualRun, orders: [], needsFilter: true, needsDates: false, scope };
  }
  const todayBounds = bakuDayBounds(todayBakuYmd());
  const todayStart = todayBounds.start;
  const todayEnd = todayBounds.end;
  let rangeStart = todayStart;
  let rangeEnd: Date | null = null;
  if (scope !== "due") {
    const from = filter?.dateFrom?.trim() ?? "";
    const to = filter?.dateTo?.trim() ?? "";
    if (!from || !to) {
      return { dualRun, orders: [], needsFilter: false, needsDates: true, scope };
    }
    try {
      rangeStart = bakuDayBounds(from).start;
      rangeEnd = bakuDayBounds(to).end;
    } catch {
      return { dualRun, orders: [], needsFilter: false, needsDates: true, scope };
    }
    if (rangeEnd.getTime() <= rangeStart.getTime()) {
      return { dualRun, orders: [], needsFilter: false, needsDates: true, scope };
    }
  }
  const start = todayStart;
  const history = scope !== "due";
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
        importedHistorical: false,
        ...(history
          ? {
              status: { not: "CANCELLED" },
              OR: [
                { scheduledAt: { gte: rangeStart, lt: rangeEnd! } },
                { extraTicketIssuedAt: { gte: rangeStart, lt: rangeEnd! } },
              ],
            }
          : {
              OR: [
                {
                  extraTicketIssuedAt: null,
                  scheduledAt: { gte: start },
                  OR: [
                    { status: "PENDING_PAY" },
                    {
                      status: { in: ["PROPOSED", "SCHEDULED"] },
                      amountNet: { gt: 0 },
                    },
                  ],
                },
                {
                  extraTicketIssuedAt: { not: null },
                  scheduledAt: { gte: start, lt: todayEnd },
                  status: { not: "CANCELLED" },
                  amountNet: { gt: 0 },
                },
              ],
            }),
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
      take: 400,
    }),
    prisma.labOrder.findMany({
      where: {
        amountNet: { gt: 0 },
        inPackage: false,
        status: { not: "CANCELLED" },
        NOT: { episode: { status: "CLOSED" } },
        ...(history
          ? {
              OR: [
                { scheduledCollectionAt: { gte: rangeStart, lt: rangeEnd! } },
                {
                  scheduledCollectionAt: null,
                  createdAt: { gte: rangeStart, lt: rangeEnd! },
                },
                { settledAt: { gte: rangeStart, lt: rangeEnd! } },
              ],
            }
          : {
              OR: [
                {
                  settledAt: null,
                  OR: [
                    { scheduledCollectionAt: { gte: start } },
                    { scheduledCollectionAt: null, createdAt: { gte: start } },
                  ],
                },
                {
                  settledAt: { not: null },
                  paymentReceiptRef: { not: null },
                  OR: [
                    { scheduledCollectionAt: { gte: start, lt: todayEnd } },
                    {
                      scheduledCollectionAt: null,
                      createdAt: { gte: start, lt: todayEnd },
                    },
                  ],
                },
              ],
            }),
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
      take: 400,
    }),
    prisma.visit.findMany({
      where: {
        amountNet: { gt: 0 },
        status: { not: "CANCELLED" },
        ...(history
          ? {
              OR: [
                { appointment: { scheduledAt: { gte: rangeStart, lt: rangeEnd! } } },
                { appointment: null, createdAt: { gte: rangeStart, lt: rangeEnd! } },
                { settledAt: { gte: rangeStart, lt: rangeEnd! } },
              ],
            }
          : {
              OR: [
                {
                  settledAt: null,
                  OR: [
                    { appointment: { scheduledAt: { gte: start } } },
                    { appointment: null, createdAt: { gte: start } },
                  ],
                },
                {
                  settledAt: { not: null },
                  paymentReceiptRef: { not: null },
                  OR: [
                    { appointment: { scheduledAt: { gte: start, lt: todayEnd } } },
                    {
                      appointment: null,
                      createdAt: { gte: start, lt: todayEnd },
                    },
                  ],
                },
              ],
            }),
        NOT: [
          { serviceLines: { some: { inPackage: true } } },
          { clinicalEpisode: { status: "CLOSED" } },
        ],
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
      take: 400,
    }),
  ]);

  function decorate(row: Omit<ExtraTicketListRow, "bucket" | "printPath">): ExtraTicketListRow | null {
    const bucket = classifyExtraListBucket({
      status: row.status,
      scheduledAt: row.scheduledAt,
      issuedAt: row.extraTicketIssuedAt,
      todayStart,
    });
    const keepIssuedToday =
      scope === "due" &&
      bucket === "issued" &&
      dueDeskKeepsIssuedToday({
        scheduledAt: row.scheduledAt,
        todayStart,
        todayEnd,
      });
    if (!bucket || (!extraListBucketMatches(scope, bucket) && !keepIssuedToday)) return null;
    if (bucket === "due" || bucket === "overdue") {
      if (row.status === "COMPLETED") return null;
      if (row.amountNet <= 0 && row.status !== "PENDING_PAY") return null;
    }
    return {
      ...row,
      bucket,
      printPath: row.extraTicketId
        ? extraTicketPrintPath(row.extraTicketId, orgId)
        : null,
    };
  }

  const orders = [
    ...procedures.map((o) =>
      decorate({
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
        extraTicketId: o.extraTicketId,
      }),
    ),
    ...labs.map((o) => {
      const svc = o.items[0]?.diagnosticService;
      const code = o.items[0]?.serviceCode || o.testCode;
      const paid = Boolean(o.settledAt && o.paymentReceiptRef);
      return decorate({
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
        status: paid ? "PAID" : "AWAITING_PAYMENT",
        extraTicketIssuedAt: paid ? o.settledAt : null,
        extraTicketId: null,
      });
    }),
    ...visits.map((v) => {
      const line = v.serviceLines[0];
      const paid = Boolean(v.settledAt && v.paymentReceiptRef);
      return decorate({
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
        status: paid ? "PAID" : "AWAITING_PAYMENT",
        extraTicketIssuedAt: paid ? v.settledAt : null,
        extraTicketId: null,
      });
    }),
  ]
    .filter((row): row is ExtraTicketListRow => row != null)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return { dualRun, orders, needsFilter: false, needsDates: false, scope };
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
