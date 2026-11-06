import type { Prisma, ProcedureOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintBranding, PrintLang } from "@/domain/print/print-types";
import { buildNurseInstruction } from "@/domain/procedure/nurse-order-instruction";
import { readPhysioFields } from "@/domain/physio/physio-order-fields";
import { bakuDayBounds } from "@/domain/ops/day-summary.service";
import { bakuTimeLabel } from "@/lib/baku-day";
import { printDateFromYmd, PRINT_PROCEDURE_STATUSES } from "@/domain/print/print-procedures.service";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";
import {
  compareOpenUnseatedFirst,
  isOpenUnseatedOrder,
} from "@/domain/procedure/open-attendance-order";

export type NurseDayPrintRow = {
  no: number;
  time: string;
  name: string;
  patient: string;
  zones: string;
  settings: string;
  note: string;
};

export type NurseDayPrintDocument = {
  branding: PrintBranding;
  titleDate: string;
  staffName: string;
  rows: NurseDayPrintRow[];
};

const SHEET_STATUSES: ProcedureOrderStatus[] = [...PRINT_PROCEDURE_STATUSES];

export async function buildNurseDayPrint(input: {
  lang: PrintLang;
  date: string;
  practitionerId?: string | null;
  /** Same package gate as GET /api/procedures?mine=1. */
  mine?: boolean;
  patient?: string | null;
  procedure?: string | null;
  /** Exact procedure type code. Reception sheet uses this instead of a text search. */
  procedureCode?: string | null;
  /** Mine was asked and this login has no practitioner. */
  empty?: boolean;
}): Promise<NurseDayPrintDocument> {
  const branding = await getPrintBranding(input.lang);
  if (input.empty) {
    return {
      branding,
      titleDate: printDateFromYmd(bakuDayBounds(input.date).date),
      staffName: printLabel(input.lang, "allStaff"),
      rows: [],
    };
  }
  const { start, end, date } = bakuDayBounds(input.date);
  const staffId = input.practitionerId?.trim() || null;
  const staff = staffId
    ? await prisma.practitioner.findFirst({
        where: { id: staffId },
        select: { fullName: true },
      })
    : null;

  const seatedOrPackage: Prisma.ProcedureOrderWhereInput[] = [
    {
      OR: [{ status: { not: "PENDING_PAY" } }, { resourceId: { not: null } }],
    },
  ];
  if (input.mine) {
    seatedOrPackage.push({
      OR: [
        { inPackage: true },
        { extraTicketIssuedAt: { not: null } },
        { status: "PENDING_PAY", resourceId: { not: null } },
      ],
    });
  }
  const where: Prisma.ProcedureOrderWhereInput = {
    scheduledAt: { gte: start, lt: end },
    OR: [
      { status: { in: SHEET_STATUSES } },
      { status: "PENDING_PAY", resourceId: { not: null } },
    ],
    AND: seatedOrPackage,
  };
  if (staffId) {
    where.allocations = { some: { role: "STAFF", practitionerId: staffId } };
  }
  const patientQ = input.patient?.trim();
  if (patientQ) {
    where.patientRef = {
      OR: [
        { fullName: { contains: patientQ, mode: "insensitive" } },
        { refCode: { contains: patientQ, mode: "insensitive" } },
      ],
    };
  }
  const procedureCode = input.procedureCode?.trim();
  if (procedureCode) {
    where.procedureCode = procedureCode;
  }
  const procedureQ = procedureCode ? "" : input.procedure?.trim();
  if (procedureQ) {
    const nameMatch: Prisma.ProcedureOrderWhereInput = {
      OR: [
        { procedureCode: { contains: procedureQ, mode: "insensitive" } },
        { procedureName: { contains: procedureQ, mode: "insensitive" } },
      ],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), nameMatch];
  }

  const orders = await prisma.procedureOrder.findMany({
    where,
    include: {
      patientRef: { select: { fullName: true } },
      clinicalEpisode: { select: { roomNumber: true } },
      resource: { select: { id: true } },
      sites: {
        orderBy: { sortOrder: "asc" },
        include: { site: true },
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
  });
  orders.sort((a, b) =>
    compareOpenUnseatedFirst(
      {
        openUnseated: isOpenUnseatedOrder(a),
        atMs: a.scheduledAt.getTime(),
      },
      {
        openUnseated: isOpenUnseatedOrder(b),
        atMs: b.scheduledAt.getTime(),
      },
    ),
  );

  const catalogNames = await loadCatalogDisplayNameMap(
    orders.map((order) => order.procedureCode),
    input.lang,
  );
  const listIds = [
    ...new Set(
      orders.flatMap((order) => {
        const fields = readPhysioFields(order.physioFields);
        return [fields.deviceProgramId, fields.substanceId].filter((id): id is string => Boolean(id));
      }),
    ),
  ];
  const bodyCodes = [
    ...new Set(orders.map((order) => order.bodyPart).filter((code): code is string => Boolean(code))),
  ];
  const [listItems, bodyRows] = await Promise.all([
    listIds.length
      ? prisma.physioListItem.findMany({
          where: { id: { in: listIds } },
          select: { id: true, titleAz: true, titleRu: true, titleEn: true },
        })
      : Promise.resolve([]),
    bodyCodes.length
      ? prisma.clinicLookup.findMany({
          where: { kind: "BODY_PART", code: { in: bodyCodes } },
          select: { code: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const listTitles = new Map(listItems.map((row) => [row.id, row]));
  const bodyNames = new Map(bodyRows.map((row) => [row.code, row.name]));

  const rows: NurseDayPrintRow[] = orders.map((order, index) => {
    const openUnseated = order.schedulingMode === "OPEN" && !order.resourceId;
    const instruction = buildNurseInstruction({
      locale: input.lang,
      bodyPartName: order.bodyPart ? (bodyNames.get(order.bodyPart) ?? order.bodyPart) : null,
      siteApplyMode: order.siteApplyMode,
      note: order.note,
      physioFields: order.physioFields,
      sites: order.sites,
      listTitles,
    });
    const room = order.clinicalEpisode?.roomNumber?.trim();
    const patient = [order.patientRef.fullName?.trim(), room].filter(Boolean).join(" · ");
    const ends = !openUnseated && order.endsAt ? `-${bakuTimeLabel(order.endsAt)}` : "";
    return {
      no: index + 1,
      time: openUnseated
        ? printLabel(input.lang, "openAttendance")
        : `${bakuTimeLabel(order.scheduledAt)}${ends}`,
      name: resolveOrderDisplayName(order, catalogNames),
      patient: patient || "—",
      zones: [instruction.bodyPart, ...instruction.sites].filter(Boolean).join(", "),
      settings: [instruction.applyMode, ...instruction.fields].filter(Boolean).join(" · "),
      note: [
        order.status === "PENDING_PAY" ? printLabel(input.lang, "unpaidExtra") : "",
        openUnseated ? printLabel(input.lang, "openAttendance") : "",
        instruction.note ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });

  return {
    branding,
    titleDate: printDateFromYmd(date),
    staffName: staff?.fullName?.trim() || printLabel(input.lang, "allStaff"),
    rows,
  };
}
