import type { Prisma, LabResultSource } from "@prisma/client";
import { type SatelliteTransactionClient } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  assertLabOrderCanCreate,
  findEpisodeLabConflict,
} from "@/domain/lab/lab-order-conflict.service";
import {
  enrichResultLines,
  hasCriticalFlag,
  type ResultLineInput,
} from "@/lib/lab-result-flags";

export type { ResultLineInput };

/** Thrown when over-quota labs are blocked by `procedureOverQuotaPolicy`. */
export const LAB_OVER_QUOTA_BLOCKED = "LAB_OVER_QUOTA_BLOCKED";

type Tx = SatelliteTransactionClient;

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
  stamps?: Map<string, { inPackage: boolean; packageQuotaCode: string | null }>,
  amountsByCode?: Record<string, number>,
): Promise<Array<ResultTargetItem>> {
  const items: Array<ResultTargetItem> = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const svc = servicesByCode.get(code);
    const stamp = stamps?.get(code);
    const amountNet =
      amountsByCode && Object.prototype.hasOwnProperty.call(amountsByCode, code)
        ? Number(amountsByCode[code] ?? 0)
        : 0;
    const item = await tx.labOrderItem.create({
      data: {
        labOrderId,
        diagnosticServiceId: svc?.id,
        serviceCode: code,
        sortOrder: i,
        amountNet,
        inPackage: stamp?.inPackage ?? false,
        packageQuotaCode: stamp?.packageQuotaCode ?? null,
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
  /** Optional per-code amounts; when omitted with episode, resolved via entitlement charge. */
  amountsByCode?: Record<string, number>;
  source?: LabResultSource;
  resultDate?: Date;
  fasting?: boolean;
  scheduledCollectionAt?: Date;
  /** Raw (un-enriched) result lines; only used when source is EXTERNAL. */
  resultLines?: RawResultLine[];
  /** Allow repeat when a prior PUBLISHED/COMPLETED order exists on the episode. */
  confirmRepeat?: boolean;
  patientOrigin?: "WALK_IN" | "IN_HOUSE";
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
  if (params.clinicalEpisodeId) {
    const conflict = await findEpisodeLabConflict(params.clinicalEpisodeId, codes);
    assertLabOrderCanCreate(conflict, params.confirmRepeat);
  }
  const servicesByCode = await resolveDiagnosticServicesByCodes(codes);
  const isExternal = params.source === "EXTERNAL";
  const enrichedLines =
    isExternal && params.resultLines?.length
      ? enrichResultLines(normalizeResultLines(params.resultLines))
      : [];

  const stamps = new Map<string, { inPackage: boolean; packageQuotaCode: string | null }>();
  const amountsByCode: Record<string, number> = { ...(params.amountsByCode ?? {}) };
  let resolvedOrigin: "WALK_IN" | "IN_HOUSE" = params.patientOrigin ?? "IN_HOUSE";
  const overQuotaCodes: string[] = [];

  if (params.clinicalEpisodeId) {
    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id: params.clinicalEpisodeId },
      select: { patientOrigin: true },
    });
    if (episode?.patientOrigin === "WALK_IN") resolvedOrigin = "WALK_IN";
    else if (params.patientOrigin) resolvedOrigin = params.patientOrigin;
  }

  {
    const { resolvePackageStampForEpisode } = await import(
      "@/domain/sanatorium/entitlement-usage.service"
    );
    const { applyPriceMissingFallback, resolveEntitlementCharge } = await import(
      "@/domain/sanatorium/entitlement-charge.service"
    );

    // Runs without an episode too: no package can apply, so every code must carry
    // its list price instead of the silent 0 that used to be written.
    for (const code of codes) {
      const stamp = params.clinicalEpisodeId
        ? await resolvePackageStampForEpisode({
            episodeId: params.clinicalEpisodeId,
            serviceCode: code,
          })
        : null;
      if (stamp) {
        stamps.set(code, {
          inPackage: true,
          packageQuotaCode: stamp.packageQuotaCode,
        });
      }
      if (!Object.prototype.hasOwnProperty.call(amountsByCode, code)) {
        const charge = applyPriceMissingFallback(
          await resolveEntitlementCharge({
            episodeId: params.clinicalEpisodeId,
            patientOrigin: resolvedOrigin,
            quotaCode: stamp?.packageQuotaCode,
            serviceCode: code,
            inPackage: Boolean(stamp),
          }),
          { serviceCode: code, where: "lab" },
        );
        amountsByCode[code] = charge.amountNet;
        if (charge.overQuota) overQuotaCodes.push(code);
      }
    }
  }

  if (overQuotaCodes.length > 0) {
    const { getSchedulingSettings } = await import(
      "@/domain/settings/scheduling-settings"
    );
    const settings = await getSchedulingSettings();
    if (settings.procedureOverQuotaPolicy === "BLOCK") {
      const err = new Error(
        `Package quota exceeded for ${overQuotaCodes.join(", ")} — lab order blocked`,
      );
      (err as Error & { code?: string }).code = LAB_OVER_QUOTA_BLOCKED;
      throw err;
    }
    console.warn("[lab-order] over-quota codes charged at list price", overQuotaCodes);
  }

  const orderAmountNet =
    params.amountNet ??
    Object.values(amountsByCode).reduce((sum, n) => sum + Number(n || 0), 0);

  const orderId = await prisma.$transaction(async (tx) => {
    const created = await tx.labOrder.create({
      data: {
        organizationId: requestOrganizationId(),
        patientRefId: params.patientRefId,
        visitId: params.visitId,
        clinicalEpisodeId: params.clinicalEpisodeId,
        testCode: codes.join(","),
        amountNet: orderAmountNet,
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

    const items = await createOrderItems(
      tx,
      created.id,
      codes,
      servicesByCode,
      stamps,
      amountsByCode,
    );
    if (isExternal && enrichedLines.length) {
      await createResultsForItems(tx, items, enrichedLines);
    }

    return created.id;
  });

  if (params.clinicalEpisodeId && stamps.size > 0) {
    const { resolveEntitlementInstance, syncEntitlementUsage } = await import(
      "@/domain/sanatorium/entitlement-usage.service"
    );
    const instance = await resolveEntitlementInstance(params.clinicalEpisodeId);
    if (instance) {
      const codesSynced = new Set<string>();
      for (const stamp of stamps.values()) {
        if (!stamp.packageQuotaCode || codesSynced.has(stamp.packageQuotaCode)) continue;
        codesSynced.add(stamp.packageQuotaCode);
        await syncEntitlementUsage({
          instanceId: instance.id,
          episodeId: params.clinicalEpisodeId,
          quotaCode: stamp.packageQuotaCode,
        });
      }
    }
  }

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
    let items: ResultTargetItem[] = order.items.map((it: { id: string; diagnosticService: { analytes: { code: string }[] } | null }) => ({
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
        organizationId: requestOrganizationId(),
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
