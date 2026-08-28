/**
 * Org-slice export/import for PlacementJob (CP-PLACE-01).
 * Hotel curated JSON slice v1 — not a full property pg_dump.
 */

export const ORG_SLICE_FORMAT_VERSION = 1 as const;
export const ORG_SLICE_NOTE_HOTEL_V1 = "hotel curated json slice v1";

export type SliceModelDelegate = {
  findMany: (args: {
    where: { organizationId: string };
  }) => Promise<Record<string, unknown>[]>;
  create?: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  deleteMany?: (args: {
    where: { organizationId: string };
  }) => Promise<unknown>;
};

export type OrgSliceTableMeta = {
  name: string;
  rowCount: number;
};

export type OrgSliceExportResult = {
  organizationId: string;
  formatVersion: typeof ORG_SLICE_FORMAT_VERSION;
  tables: OrgSliceTableMeta[];
  rows: Record<string, Record<string, unknown>[]>;
  note: string;
};

export type OrgSliceImportResult =
  | {
      ok: true;
      mode: "validate" | "upsert";
      tables: OrgSliceTableMeta[];
    }
  | { ok: false; reason: string };

function requireOrgId(organizationId: string): string {
  const id = organizationId?.trim();
  if (!id) throw new Error("organizationId required for org slice");
  return id;
}

/**
 * Dump rows for each model where organizationId matches.
 * Caller must pass delegates that can read cross-tenant (e.g. ERA_SKIP_TENANT_FILTER).
 */
export async function exportOrgSlice(input: {
  organizationId: string;
  models: Record<string, SliceModelDelegate>;
  note?: string;
}): Promise<OrgSliceExportResult> {
  const organizationId = requireOrgId(input.organizationId);
  const rows: Record<string, Record<string, unknown>[]> = {};
  const tables: OrgSliceTableMeta[] = [];

  for (const [name, delegate] of Object.entries(input.models)) {
    const found = await delegate.findMany({
      where: { organizationId },
    });
    const list = Array.isArray(found) ? found : [];
    rows[name] = list;
    tables.push({ name, rowCount: list.length });
  }

  return {
    organizationId,
    formatVersion: ORG_SLICE_FORMAT_VERSION,
    tables,
    rows,
    note: input.note ?? ORG_SLICE_NOTE_HOTEL_V1,
  };
}

/**
 * Lab/orch summary without DB — still not "not implemented full dump".
 */
export function exportOrgSliceLabSummary(organizationId: string): Omit<
  OrgSliceExportResult,
  "rows"
> & { rows?: undefined; rowCounts: Record<string, number> } {
  const id = requireOrgId(organizationId);
  const tables: OrgSliceTableMeta[] = [
    { name: "role", rowCount: 0 },
    { name: "user", rowCount: 0 },
    { name: "guest", rowCount: 0 },
  ];
  return {
    organizationId: id,
    formatVersion: ORG_SLICE_FORMAT_VERSION,
    tables,
    rowCounts: Object.fromEntries(tables.map((t) => [t.name, t.rowCount])),
    note: `${ORG_SLICE_NOTE_HOTEL_V1} (lab)`,
  };
}

export async function importOrgSlice(input: {
  organizationId: string;
  models: Record<string, SliceModelDelegate>;
  /** Ordered model names matching export order (FK-safe). */
  modelOrder: string[];
  slice: OrgSliceExportResult;
  mode: "validate" | "upsert";
}): Promise<OrgSliceImportResult> {
  const organizationId = requireOrgId(input.organizationId);
  const { slice, mode, models, modelOrder } = input;

  if (slice.formatVersion !== ORG_SLICE_FORMAT_VERSION) {
    return {
      ok: false,
      reason: `unsupported formatVersion ${String(slice.formatVersion)}`,
    };
  }
  if (slice.organizationId !== organizationId) {
    return {
      ok: false,
      reason: `slice organizationId mismatch (slice=${slice.organizationId}, target=${organizationId})`,
    };
  }

  const tables: OrgSliceTableMeta[] = slice.tables.map((t) => ({ ...t }));

  if (mode === "validate") {
    return { ok: true, mode, tables };
  }

  for (const name of modelOrder) {
    const delegate = models[name];
    if (!delegate?.create) {
      return { ok: false, reason: `model ${name} missing create delegate` };
    }
    const list = slice.rows[name] ?? [];
    if (delegate.deleteMany) {
      await delegate.deleteMany({ where: { organizationId } });
    }
    for (const row of list) {
      const data = { ...row, organizationId };
      await delegate.create({ data });
    }
  }

  return { ok: true, mode: "upsert", tables };
}
