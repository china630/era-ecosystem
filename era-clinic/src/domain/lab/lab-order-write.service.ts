import type { Prisma, LabResultSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  enrichResultLines,
  hasCriticalFlag,
  type ResultLineInput,
} from "@/lib/lab-result-flags";

export type { ResultLineInput };

type Tx = Prisma.TransactionClient;

type RawResultLine = {
  code?: string;
  analyte?: string;
  value: string;
  unit?: string;
  refMin?: string | number;
  refMax?: string | number;
  flag?: string;
};

type ServiceWithAnalytes = Prisma.DiagnosticServiceGetPayload<{
  include: { analytes: true };
}>;

type ResultTargetItem = {
  id: string;
  diagnosticService: { analytes: { code: string }[] } | null;
};

const labOrderFullInclude = {
  patientRef: true,
  visit: true,
  items: {
    include: {
      diagnosticService: { include: { modality: true } },
      results: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.LabOrderInclude;

/** Normalizes loose create/import result-line shapes into the enrichable line format. */
export function normalizeResultLines(raw: RawResultLine[]): ResultLineInput[] {
  return raw.map((r) => ({
    code: r.code ?? r.analyte ?? "value",
    value: r.value,
    unit: r.unit,
    refMin: r.refMin != null ? String(r.refMin) : undefined,
    refMax: r.refMax != null ? String(r.refMax) : undefined,
    flag: normalizeFlag(r.flag),
  }));
}

function normalizeFlag(flag?: string): ResultLineInput["flag"] {
  return flag === "HIGH" || flag === "LOW" || flag === "CRITICAL" || flag === "NORMAL"
    ? flag
    : undefined;
}

/** Resolves DiagnosticService rows (with analytes) by catalog code or serviceCode, keyed by both. */
export async function resolveDiagnosticServicesByCodes(
  codes: string[],
): Promise<Map<string, ServiceWithAnalytes>> {
  if (codes.length === 0) return new Map();
  const rows = await prisma.diagnosticService.findMany({
    where: { OR: [{ code: { in: codes } }, { serviceCode: { in: codes } }] },
    include: { analytes: true },
  });
  const map = new Map<string, ServiceWithAnalytes>();
  for (const row of rows) {
    map.set(row.code, row);
    map.set(row.serviceCode, row);
  }
  return map;
}

/** Picks the item whose service analytes include the line code; falls back to the first item. */
function pickItemForCode<T extends ResultTargetItem>(items: T[], code: string): T | undefined {
  const match = items.find((it) =>
    it.diagnosticService?.analytes.some((a) => a.code === code),
  );
  return match ?? items[0];
}

/** Creates one LabOrderItem per code, resolving the DiagnosticService link when the code matches the catalog. */
async function createOrderItems(
  tx: Tx,
  labOrderId: string,
  codes: string[],
  servicesByCode: Map<string, ServiceWithAnalytes>,
): Promise<Array<ResultTargetItem>> {
  const items: Array<ResultTargetItem> = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const svc = servicesByCode.get(code);
    const item = await tx.labOrderItem.create({
      data: {
        labOrderId,
        diagnosticServiceId: svc?.id,
        serviceCode: code,
        sortOrder: i,
      },
    });
    items.push({
      id: item.id,
      diagnosticService: svc ? { analytes: svc.analytes } : null,
    });
  }
  return items;
}

/** Creates fresh LabResult rows for enriched lines, distributing across items by analyte code. */
async function createResultsForItems(
  tx: Tx,
  items: ResultTargetItem[],
  lines: ResultLineInput[],
): Promise<void> {
  if (items.length === 0) return;
  for (const line of lines) {
    const target = pickItemForCode(items, line.code);
    if (!target) continue;
    await tx.labResult.create({
      data: {
        labOrderItemId: target.id,
        code: line.code,
        value: line.value,
        unit: line.unit,
        refMin: line.refMin,
        refMax: line.refMax,
        flag: line.flag ?? "NORMAL",
      },
    });
  }
}

/** Upserts LabResult rows (by labOrderItemId+code) so results entry stays editable up to publish. */
async function upsertResultsForItems(
  tx: Tx,
  items: ResultTargetItem[],
  lines: ResultLineInput[],
): Promise<void> {
  if (items.length === 0) return;
  for (const line of lines) {
    const target = pickItemForCode(items, line.code);
    if (!target) continue;
    await tx.labResult.upsert({
      where: { labOrderItemId_code: { labOrderItemId: target.id, code: line.code } },
      create: {
        labOrderItemId: target.id,
        code: line.code,
        value: line.value,
        unit: line.unit,
        refMin: line.refMin,
        refMax: line.refMax,
        flag: line.flag ?? "NORMAL",
      },
      update: {
        value: line.value,
        unit: line.unit,
        refMin: line.refMin,
        refMax: line.refMax,
        flag: line.flag ?? "NORMAL",
      },
    });
  }
}

export type CreateLabOrderWithItemsParams = {
  patientRefId: string;
  visitId?: string;
  clinicalEpisodeId?: string;
  codes: string[];
  amountNet?: number;
  source?: LabResultSource;
  resultDate?: Date;
  fasting?: boolean;
  scheduledCollectionAt?: Date;
  /** Raw (un-enriched) result lines; only used when source is EXTERNAL. */
  resultLines?: RawResultLine[];
};

/**
 * Creates a LabOrder + one LabOrderItem per code. When source is EXTERNAL and resultLines are
 * supplied, also creates LabResult rows (distributed by analyte code, else the first item) and
 * dual-writes the legacy resultJson snapshot.
 */
export async function createLabOrderWithItems(
  params: CreateLabOrderWithItemsParams,
): Promise<Prisma.LabOrderGetPayload<{ include: typeof labOrderFullInclude }>> {
  const codes = params.codes;
  const servicesByCode = await resolveDiagnosticServicesByCodes(codes);
  const isExternal = params.source === "EXTERNAL";
  const enrichedLines =
    isExternal && params.resultLines?.length
      ? enrichResultLines(normalizeResultLines(params.resultLines))
      : [];

  const orderId = await prisma.$transaction(async (tx) => {
    const created = await tx.labOrder.create({
      data: {
        patientRefId: params.patientRefId,
        visitId: params.visitId,
        clinicalEpisodeId: params.clinicalEpisodeId,
        testCode: codes.join(","),
        amountNet: params.amountNet ?? 0,
        source: params.source ?? "IN_HOUSE",
        resultDate: params.resultDate,
        fasting: params.fasting ?? false,
        scheduledCollectionAt: params.scheduledCollectionAt,
        ...(isExternal
          ? {
              status: "RESULT_READY" as const,
              resultJson: JSON.stringify(enrichedLines),
              publishedAt: new Date(),
              collectedAt: params.resultDate,
            }
          : {}),
      },
    });

    const items = await createOrderItems(tx, created.id, codes, servicesByCode);
    if (isExternal && enrichedLines.length) {
      await createResultsForItems(tx, items, enrichedLines);
    }

    return created.id;
  });

  return prisma.labOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: labOrderFullInclude,
  });
}

/**
 * Writes result lines onto an existing LabOrder: enriches flags, upserts LabResult rows on the
 * matching item (or the first item), dual-writes resultJson, and marks status RESULT_READY.
 */
export async function writeLabResultsForOrder(
  orderId: string,
  rawLines: ResultLineInput[],
): Promise<{
  order: Prisma.LabOrderGetPayload<{ include: typeof labOrderFullInclude }>;
  enrichedLines: ResultLineInput[];
  hasCritical: boolean;
} | null> {
  const order = await prisma.labOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { diagnosticService: { include: { analytes: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!order) return null;

  const enrichedLines = enrichResultLines(rawLines);

  await prisma.$transaction(async (tx) => {
    let items: ResultTargetItem[] = order.items.map((it) => ({
      id: it.id,
      diagnosticService: it.diagnosticService
        ? { analytes: it.diagnosticService.analytes }
        : null,
    }));

    if (items.length === 0) {
      const fallbackCode = order.testCode.split(",")[0]?.trim() ?? order.testCode;
      const created = await tx.labOrderItem.create({
        data: { labOrderId: order.id, serviceCode: fallbackCode },
      });
      items = [{ id: created.id, diagnosticService: null }];
    }

    await upsertResultsForItems(tx, items, enrichedLines);

    await tx.labOrder.update({
      where: { id: order.id },
      data: {
        status: "RESULT_READY",
        resultJson: JSON.stringify(enrichedLines),
      },
    });
  });

  const updated = await prisma.labOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: labOrderFullInclude,
  });

  return {
    order: updated,
    enrichedLines,
    hasCritical: hasCriticalFlag(enrichedLines),
  };
}

export type ImportedLabResultLine = RawResultLine;

/**
 * Import-flow helper: creates a LabOrder for a single (already resolved) code together with its
 * item and result rows, dual-writing legacy resultJson. Used by CSV/LIS import routes.
 */
export async function createImportedLabOrder(params: {
  patientRefId: string;
  visitId?: string;
  code: string;
  results: RawResultLine[];
  status?: "RESULT_READY";
  publishedAt?: Date;
  source?: LabResultSource;
  resultDate?: Date;
}): Promise<Prisma.LabOrderGetPayload<{ include: typeof labOrderFullInclude }>> {
  const servicesByCode = await resolveDiagnosticServicesByCodes([params.code]);
  const enrichedLines = enrichResultLines(normalizeResultLines(params.results));

  const orderId = await prisma.$transaction(async (tx) => {
    const created = await tx.labOrder.create({
      data: {
        patientRefId: params.patientRefId,
        visitId: params.visitId,
        testCode: params.code,
        status: params.status ?? "RESULT_READY",
        resultJson: JSON.stringify(enrichedLines),
        publishedAt: params.publishedAt ?? new Date(),
        source: params.source,
        resultDate: params.resultDate,
        collectedAt: params.resultDate,
      },
    });

    const items = await createOrderItems(tx, created.id, [params.code], servicesByCode);
    await createResultsForItems(tx, items, enrichedLines);

    return created.id;
  });

  return prisma.labOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: labOrderFullInclude,
  });
}
