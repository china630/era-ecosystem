/**
 * Patient/episode assignment ledger — procedures, labs, visits (package + paid).
 * Amount only after payment acceptance (settledAt / paymentReceiptRef); package burns = 0.
 */
import { bakuDateTimeDisplay } from "@/lib/baku-day";
import { prisma } from "@/lib/prisma";

export type AssignmentKind = "procedure" | "lab" | "visit";

export type AssignmentLedgerRow = {
  id: string;
  kind: AssignmentKind;
  code: string;
  name: string;
  assigned: number;
  completed: number;
  scheduledAt: string | null;
  scheduledAtLabel: string | null;
  roomNumber: string | null;
  amount: number;
  inPackage: boolean;
  status: string;
};

export type AssignmentLedgerTotals = {
  assigned: number;
  completed: number;
  amount: number;
};

export type AssignmentLedgerResult = {
  episode: {
    id: string;
    status: string;
    roomNumber: string | null;
    programCode: string | null;
    patientRefId: string | null;
    patientLabel: string;
  };
  rooms: string[];
  rows: AssignmentLedgerRow[];
  totals: AssignmentLedgerTotals;
};

export function isProcedureCompleted(status: string): boolean {
  return status === "COMPLETED";
}

export function isLabCompleted(status: string): boolean {
  return status === "COMPLETED" || status === "PUBLISHED";
}

export function isVisitCompleted(status: string): boolean {
  return status === "COMPLETED";
}

/** Empty lines are not a package burn (`[].every()` would be true). */
export function visitLinesAreInPackage(
  lines: Array<{ inPackage: boolean }>,
): boolean {
  return lines.length > 0 && lines.every((l) => l.inPackage);
}

/** Cash amount for a completed row — settlement/receipt fact only; package = 0. */
export function amountForLedgerRow(input: {
  completed: boolean;
  amountNet: number;
  inPackage: boolean;
  settledAt?: Date | null;
  paymentReceiptRef?: string | null;
  kind: AssignmentKind;
}): number {
  if (!input.completed) return 0;
  if (input.inPackage) return 0;
  const net = Number(input.amountNet);
  if (!(net > 0)) return 0;
  if (input.kind === "procedure") {
    return input.paymentReceiptRef ? net : 0;
  }
  return input.settledAt ? net : 0;
}

export function sumLedgerTotals(rows: AssignmentLedgerRow[]): AssignmentLedgerTotals {
  return rows.reduce(
    (acc, row) => ({
      assigned: acc.assigned + row.assigned,
      completed: acc.completed + row.completed,
      amount: Math.round((acc.amount + row.amount) * 100) / 100,
    }),
    { assigned: 0, completed: 0, amount: 0 },
  );
}

function patientLabel(
  p: {
    firstName: string | null;
    lastName: string | null;
    refCode: string;
  } | null,
): string {
  if (!p) return "—";
  const name = [p.lastName, p.firstName].filter(Boolean).join(" ").trim();
  return name ? `${name} (${p.refCode})` : p.refCode;
}

export async function loadPatientAssignmentLedger(input: {
  episodeId: string;
  roomNumber?: string | null;
  kind?: AssignmentKind | "all" | null;
}): Promise<AssignmentLedgerResult | null> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    select: {
      id: true,
      status: true,
      roomNumber: true,
      programCode: true,
      patientRefId: true,
      patientRef: {
        select: { firstName: true, lastName: true, refCode: true },
      },
    },
  });
  if (!episode) return null;

  const roomFilter = input.roomNumber?.trim() || null;
  const kindFilter =
    input.kind === "procedure" || input.kind === "lab" || input.kind === "visit"
      ? input.kind
      : null;

  const [procedures, labs, visits] = await Promise.all([
    kindFilter && kindFilter !== "procedure"
      ? Promise.resolve([])
      : prisma.procedureOrder.findMany({
          where: { clinicalEpisodeId: episode.id },
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            procedureCode: true,
            procedureName: true,
            status: true,
            scheduledAt: true,
            amountNet: true,
            inPackage: true,
            paymentReceiptRef: true,
          },
        }),
    kindFilter && kindFilter !== "lab"
      ? Promise.resolve([])
      : prisma.labOrder.findMany({
          where: { clinicalEpisodeId: episode.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            testCode: true,
            status: true,
            amountNet: true,
            inPackage: true,
            settledAt: true,
            roomNumber: true,
            scheduledCollectionAt: true,
            createdAt: true,
            items: {
              select: {
                serviceCode: true,
                diagnosticService: {
                  select: { titleAz: true, titleRu: true, titleEn: true },
                },
              },
              take: 1,
            },
          },
        }),
    kindFilter && kindFilter !== "visit"
      ? Promise.resolve([])
      : prisma.visit.findMany({
          where: { clinicalEpisodeId: episode.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            amountNet: true,
            settledAt: true,
            roomNumber: true,
            createdAt: true,
            appointment: { select: { scheduledAt: true } },
            serviceLines: {
              select: {
                serviceCode: true,
                description: true,
                inPackage: true,
                amount: true,
              },
            },
          },
        }),
  ]);

  const allRows: AssignmentLedgerRow[] = [];

  for (const order of procedures) {
    const room = episode.roomNumber;
    const completed = isProcedureCompleted(order.status) ? 1 : 0;
    const amount = amountForLedgerRow({
      completed: completed === 1,
      amountNet: Number(order.amountNet),
      inPackage: order.inPackage,
      paymentReceiptRef: order.paymentReceiptRef,
      kind: "procedure",
    });
    allRows.push({
      id: `procedure:${order.id}`,
      kind: "procedure",
      code: order.procedureCode,
      name: order.procedureName,
      assigned: 1,
      completed,
      scheduledAt: order.scheduledAt.toISOString(),
      scheduledAtLabel: bakuDateTimeDisplay(order.scheduledAt),
      roomNumber: room,
      amount,
      inPackage: order.inPackage,
      status: order.status,
    });
  }

  for (const order of labs) {
    const room = order.roomNumber ?? episode.roomNumber;
    const completed = isLabCompleted(order.status) ? 1 : 0;
    const item = order.items[0];
    const when = order.scheduledCollectionAt ?? order.createdAt;
    const amount = amountForLedgerRow({
      completed: completed === 1,
      amountNet: Number(order.amountNet),
      inPackage: order.inPackage,
      settledAt: order.settledAt,
      kind: "lab",
    });
    const labTitle =
      item?.diagnosticService?.titleAz?.trim() ||
      item?.diagnosticService?.titleRu?.trim() ||
      item?.diagnosticService?.titleEn?.trim() ||
      item?.serviceCode ||
      order.testCode;
    allRows.push({
      id: `lab:${order.id}`,
      kind: "lab",
      code: item?.serviceCode || order.testCode,
      name: labTitle,
      assigned: 1,
      completed,
      scheduledAt: when.toISOString(),
      scheduledAtLabel: bakuDateTimeDisplay(when),
      roomNumber: room,
      amount,
      inPackage: order.inPackage,
      status: order.status,
    });
  }

  for (const visit of visits) {
    const room = visit.roomNumber ?? episode.roomNumber;
    const completed = isVisitCompleted(visit.status) ? 1 : 0;
    const inPackage = visitLinesAreInPackage(visit.serviceLines);
    const lineAmount = visit.serviceLines.reduce((s, l) => s + Number(l.amount), 0);
    const amountNet = Number(visit.amountNet) > 0 ? Number(visit.amountNet) : lineAmount;
    const when = visit.appointment?.scheduledAt ?? visit.createdAt;
    const code =
      visit.serviceLines.map((l) => l.serviceCode).filter(Boolean).join("+") || "VISIT";
    const title =
      visit.serviceLines.map((l) => l.description).filter(Boolean).join(", ") ||
      visit.serviceLines.map((l) => l.serviceCode).filter(Boolean).join(", ") ||
      code;
    const amount = amountForLedgerRow({
      completed: completed === 1,
      amountNet,
      inPackage,
      settledAt: visit.settledAt,
      kind: "visit",
    });
    allRows.push({
      id: `visit:${visit.id}`,
      kind: "visit",
      code,
      name: title,
      assigned: 1,
      completed,
      scheduledAt: when.toISOString(),
      scheduledAtLabel: bakuDateTimeDisplay(when),
      roomNumber: room,
      amount,
      inPackage,
      status: visit.status,
    });
  }

  allRows.sort((a, b) => {
    const ta = a.scheduledAt ?? "";
    const tb = b.scheduledAt ?? "";
    return ta.localeCompare(tb);
  });

  // Room options stay stable while a room filter is applied.
  const rooms = [
    ...new Set(
      allRows
        .map((r) => r.roomNumber?.trim())
        .filter((r): r is string => Boolean(r)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const rows = roomFilter
    ? allRows.filter((r) => r.roomNumber === roomFilter)
    : allRows;

  return {
    episode: {
      id: episode.id,
      status: episode.status,
      roomNumber: episode.roomNumber,
      programCode: episode.programCode,
      patientRefId: episode.patientRefId,
      patientLabel: patientLabel(episode.patientRef),
    },
    rooms,
    rows,
    totals: sumLedgerTotals(rows),
  };
}
