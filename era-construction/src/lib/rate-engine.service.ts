import {
  assertEntitled,
  fetchSubscriptionSnapshot,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { replaceEstimateLines } from "@/lib/estimate.service";

export const RATE_ENGINE_SKU = "construction_smeta_rate_engine";

export const RATE_ITEM_KINDS = [
  "LABOR",
  "MATERIAL",
  "MACHINE",
  "COMPOSITE",
] as const;
export type RateItemKind = (typeof RATE_ITEM_KINDS)[number];

function orgId() {
  return requestOrganizationId();
}

/** Fail-closed SKU gate; TIER_3 unlocks like other Construction add-ons. */
export async function requireRateEngineSkuOrError(): Promise<
  { ok: true } | { error: string; status: 403 }
> {
  const organizationId = orgId();
  try {
    const snap = await fetchSubscriptionSnapshot(organizationId);
    if (snap && String((snap as { tier?: string }).tier ?? "").toUpperCase() === "TIER_3") {
      return { ok: true };
    }
  } catch {
    /* continue */
  }
  try {
    await assertEntitled(organizationId, RATE_ENGINE_SKU);
    return { ok: true };
  } catch (err) {
    if (err instanceof IndustryModuleInactiveError) {
      return {
        error: `Module not active: ${RATE_ENGINE_SKU}`,
        status: 403,
      };
    }
    throw err;
  }
}

export async function listRateBases() {
  const gate = await requireRateEngineSkuOrError();
  if (!gate.ok) return gate;
  const items = await prisma.rateBase.findMany({
    where: { organizationId: orgId(), deletedAt: null },
    orderBy: [{ code: "asc" }, { version: "desc" }],
    include: {
      _count: { select: { items: { where: { deletedAt: null } } } },
    },
  });
  return { items };
}

export async function getRateBase(rateBaseId: string) {
  const gate = await requireRateEngineSkuOrError();
  if (!gate.ok) return gate;
  const base = await prisma.rateBase.findFirst({
    where: { id: rateBaseId, organizationId: orgId(), deletedAt: null },
    include: {
      items: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!base) return { error: "Rate base not found" as const, status: 404 as const };
  return { rateBase: base };
}

export async function createRateBase(input: {
  code: string;
  title: string;
  version?: number;
  notes?: string;
}) {
  const gate = await requireRateEngineSkuOrError();
  if (!gate.ok) return gate;
  const code = input.code.trim();
  const title = input.title.trim();
  if (!code || !title) {
    return { error: "code and title required" as const, status: 400 as const };
  }
  const version = input.version ?? 1;
  try {
    const rateBase = await prisma.rateBase.create({
      data: {
        organizationId: orgId(),
        code,
        title,
        version,
        notes: input.notes?.trim() || null,
      },
    });
    return { rateBase };
  } catch {
    return {
      error: "Rate base code+version already exists" as const,
      status: 409 as const,
    };
  }
}

export async function upsertRateItem(
  rateBaseId: string,
  input: {
    code: string;
    title: string;
    unit?: string;
    kind?: RateItemKind;
    unitAmount: number;
    materialCode?: string | null;
    compositionJson?: string;
    sortOrder?: number;
  },
) {
  const gate = await requireRateEngineSkuOrError();
  if (!gate.ok) return gate;
  const base = await prisma.rateBase.findFirst({
    where: { id: rateBaseId, organizationId: orgId(), deletedAt: null },
  });
  if (!base) return { error: "Rate base not found" as const, status: 404 as const };

  const code = input.code.trim();
  const title = input.title.trim();
  if (!code || !title) {
    return { error: "code and title required" as const, status: 400 as const };
  }
  const unitAmount = Number(input.unitAmount);
  if (!(unitAmount > 0) || Number.isNaN(unitAmount)) {
    return { error: "unitAmount must be positive" as const, status: 400 as const };
  }
  const kind = (input.kind ?? "COMPOSITE") as RateItemKind;
  if (!RATE_ITEM_KINDS.includes(kind)) {
    return { error: "Invalid rate item kind" as const, status: 400 as const };
  }

  const existing = await prisma.rateItem.findFirst({
    where: { rateBaseId, code, deletedAt: null },
  });
  const data = {
    organizationId: orgId(),
    rateBaseId,
    code,
    title,
    unit: input.unit?.trim() || "ед.",
    kind,
    unitAmount,
    materialCode: input.materialCode?.trim() || null,
    compositionJson: input.compositionJson?.trim() || "[]",
    sortOrder: input.sortOrder ?? 0,
  };

  const item = existing
    ? await prisma.rateItem.update({ where: { id: existing.id }, data })
    : await prisma.rateItem.create({ data });
  return { item };
}

export type RateCalcResult = {
  rateItemId: string;
  rateItemCode: string;
  title: string;
  unit: string;
  qty: number;
  unitAmount: number;
  amountNet: number;
  materialCode: string | null;
  composition: unknown;
};

export async function calcRate(input: {
  rateItemId: string;
  qty: number;
}): Promise<
  | { calc: RateCalcResult }
  | { error: string; status: 400 | 403 | 404 }
> {
  const gate = await requireRateEngineSkuOrError();
  if (!gate.ok) return gate;
  const qty = Number(input.qty);
  if (!(qty > 0) || Number.isNaN(qty)) {
    return { error: "qty must be positive" as const, status: 400 as const };
  }
  const item = await prisma.rateItem.findFirst({
    where: {
      id: input.rateItemId,
      organizationId: orgId(),
      deletedAt: null,
      rateBase: { deletedAt: null },
    },
  });
  if (!item) return { error: "Rate item not found" as const, status: 404 as const };

  const unitAmount = Number(item.unitAmount);
  const amountNet = Math.round(qty * unitAmount * 100) / 100;
  let composition: unknown = [];
  try {
    composition = JSON.parse(item.compositionJson || "[]");
  } catch {
    composition = [];
  }

  return {
    calc: {
      rateItemId: item.id,
      rateItemCode: item.code,
      title: item.title,
      unit: item.unit,
      qty,
      unitAmount,
      amountNet,
      materialCode: item.materialCode,
      composition,
    },
  };
}

/** Calc then append (merge) a line onto an Estimate LCR/SC document. */
export async function applyRateToEstimateDocument(input: {
  documentId: string;
  rateItemId: string;
  qty: number;
  itemCode?: string;
}) {
  const calcResult = await calcRate({
    rateItemId: input.rateItemId,
    qty: input.qty,
  });
  if ("error" in calcResult) return calcResult;

  const doc = await prisma.estimateDocument.findFirst({
    where: { id: input.documentId, deletedAt: null },
    include: {
      package: true,
      lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!doc) return { error: "Document not found" as const, status: 404 as const };

  const { calc } = calcResult;
  const nextLines = [
    ...doc.lines.map((l, index) => ({
      itemCode: l.itemCode,
      description: l.description,
      unit: l.unit,
      qty: Number(l.qty),
      unitRate: Number(l.unitRate),
      amountNet: Number(l.amountNet),
      sortOrder: l.sortOrder ?? index,
    })),
    {
      itemCode: (input.itemCode?.trim() || calc.rateItemCode).slice(0, 64),
      description: calc.title.slice(0, 500),
      unit: calc.unit,
      qty: calc.qty,
      unitRate: calc.unitAmount,
      amountNet: calc.amountNet,
      sortOrder: doc.lines.length,
    },
  ];

  const replaced = await replaceEstimateLines(input.documentId, nextLines);
  if ("error" in replaced) return replaced;
  return { calc, document: replaced.document };
}
