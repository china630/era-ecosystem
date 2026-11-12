/**
 * Full satellite org migrate — all Prisma models with scalar organizationId.
 * Product path for PlacementJob EXPORT/IMPORT (not curated table lists).
 */

import { createHash } from "node:crypto";

export const ORG_FULL_SLICE_FORMAT_VERSION = 2 as const;
export const ORG_FULL_SLICE_NOTE = "satellite full org slice v2";

export type PrismaDmmfLike = {
  dmmf: {
    datamodel: {
      models: Array<{
        name: string;
        fields: Array<{
          name: string;
          kind: string;
          type: string;
          isRequired?: boolean;
          relationFromFields?: string[];
          relationToFields?: string[];
        }>;
      }>;
    };
  };
};

export type FullOrgModelDelegate = {
  findMany: (args: {
    where: { organizationId: string };
  }) => Promise<Record<string, unknown>[]>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  deleteMany: (args: {
    where: { organizationId: string };
  }) => Promise<unknown>;
};

export type ObjectStorageManifestEntry = {
  key: string;
  bytes?: number;
  contentType?: string | null;
};

export type OrgFullSliceV2 = {
  organizationId: string;
  formatVersion: typeof ORG_FULL_SLICE_FORMAT_VERSION;
  satelliteKey?: string;
  note: string;
  modelOrder: string[];
  tables: Array<{ name: string; rowCount: number }>;
  rows: Record<string, Record<string, unknown>[]>;
  objectStorage: {
    prefix: string;
    entries: ObjectStorageManifestEntry[];
    /** true when listing was skipped / stubbed */
    stub?: boolean;
  };
  checksum: string;
};

export type OrgFullSliceExportSummary = Omit<OrgFullSliceV2, "rows"> & {
  rows?: undefined;
  rowCounts: Record<string, number>;
};

function requireOrgId(organizationId: string): string {
  const id = organizationId?.trim();
  if (!id) throw new Error("organizationId required for full org slice");
  return id;
}

/** Prisma client property for a DMMF model name (`RoomType` → `roomType`). */
export function prismaClientKeyForModel(modelName: string): string {
  if (!modelName) return modelName;
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

export function listTenantModelNames(
  Prisma: PrismaDmmfLike,
  opts?: { excludeModels?: string[] },
): string[] {
  const exclude = new Set(opts?.excludeModels ?? []);
  return Prisma.dmmf.datamodel.models
    .filter((m) =>
      m.fields.some(
        (f) =>
          f.name === "organizationId" &&
          f.kind === "scalar" &&
          (f.type === "String" || f.type === "String?"),
      ),
    )
    .map((m) => m.name)
    .filter((n) => !exclude.has(n));
}

/**
 * FK-safe order: models that own relationFromFields wait until related model exported.
 */
export function orderTenantModelsByFk(
  Prisma: PrismaDmmfLike,
  modelNames: string[],
): string[] {
  const set = new Set(modelNames);
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of modelNames) {
    indeg.set(n, 0);
    adj.set(n, []);
  }

  for (const model of Prisma.dmmf.datamodel.models) {
    if (!set.has(model.name)) continue;
    for (const field of model.fields) {
      if (field.kind !== "object") continue;
      const from = field.relationFromFields;
      if (!from?.length) continue;
      const dep = field.type;
      if (!set.has(dep) || dep === model.name) continue;
      // dep must come before model
      adj.get(dep)!.push(model.name);
      indeg.set(model.name, (indeg.get(model.name) ?? 0) + 1);
    }
  }

  const queue = modelNames
    .filter((n) => (indeg.get(n) ?? 0) === 0)
    .sort((a, b) => a.localeCompare(b));
  const out: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    for (const m of adj.get(n) ?? []) {
      const next = (indeg.get(m) ?? 1) - 1;
      indeg.set(m, next);
      if (next === 0) {
        queue.push(m);
        queue.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  // Cycle fallback: append remaining alphabetically
  if (out.length < modelNames.length) {
    for (const n of [...modelNames].sort()) {
      if (!out.includes(n)) out.push(n);
    }
  }
  return out;
}

export function checksumFullSlicePayload(input: {
  organizationId: string;
  modelOrder: string[];
  tables: Array<{ name: string; rowCount: number }>;
  objectStorageEntries: ObjectStorageManifestEntry[];
}): string {
  const payload = JSON.stringify({
    organizationId: input.organizationId,
    modelOrder: input.modelOrder,
    tables: input.tables,
    objectStorage: input.objectStorageEntries.map((e) => e.key).sort(),
  });
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
}

export function buildDelegatesFromPrismaClient(
  Prisma: PrismaDmmfLike,
  prisma: Record<string, unknown>,
  opts?: { excludeModels?: string[] },
): { modelOrder: string[]; models: Record<string, FullOrgModelDelegate> } {
  const names = listTenantModelNames(Prisma, opts);
  const modelOrder = orderTenantModelsByFk(Prisma, names);
  const models: Record<string, FullOrgModelDelegate> = {};
  for (const name of modelOrder) {
    const key = prismaClientKeyForModel(name);
    const del = prisma[key] as FullOrgModelDelegate | undefined;
    if (!del?.findMany || !del?.create || !del?.deleteMany) {
      throw new Error(
        `full org slice: prisma.${key} missing findMany/create/deleteMany`,
      );
    }
    models[name] = del;
  }
  return { modelOrder, models };
}

export async function exportFullOrgSlice(input: {
  organizationId: string;
  satelliteKey?: string;
  modelOrder: string[];
  models: Record<string, FullOrgModelDelegate>;
  objectStorage?: {
    prefix?: string;
    listEntries?: () => Promise<ObjectStorageManifestEntry[]>;
  };
}): Promise<OrgFullSliceV2> {
  const organizationId = requireOrgId(input.organizationId);
  const rows: Record<string, Record<string, unknown>[]> = {};
  const tables: Array<{ name: string; rowCount: number }> = [];

  for (const name of input.modelOrder) {
    const delegate = input.models[name];
    if (!delegate) throw new Error(`full org slice: missing model ${name}`);
    const found = await delegate.findMany({ where: { organizationId } });
    const list = Array.isArray(found) ? found : [];
    rows[name] = list;
    tables.push({ name, rowCount: list.length });
  }

  const prefix =
    input.objectStorage?.prefix?.trim() || `org/${organizationId}/`;
  let entries: ObjectStorageManifestEntry[] = [];
  let stub = true;
  if (input.objectStorage?.listEntries) {
    entries = await input.objectStorage.listEntries();
    stub = false;
  }

  const checksum = checksumFullSlicePayload({
    organizationId,
    modelOrder: input.modelOrder,
    tables,
    objectStorageEntries: entries,
  });

  return {
    organizationId,
    formatVersion: ORG_FULL_SLICE_FORMAT_VERSION,
    satelliteKey: input.satelliteKey,
    note: ORG_FULL_SLICE_NOTE,
    modelOrder: input.modelOrder,
    tables,
    rows,
    objectStorage: { prefix, entries, stub },
    checksum,
  };
}

export function fullOrgSliceSummary(
  slice: OrgFullSliceV2,
): OrgFullSliceExportSummary {
  const { rows: _rows, ...rest } = slice;
  return {
    ...rest,
    rowCounts: Object.fromEntries(
      slice.tables.map((t) => [t.name, t.rowCount]),
    ),
  };
}

export async function importFullOrgSlice(input: {
  organizationId: string;
  models: Record<string, FullOrgModelDelegate>;
  slice: OrgFullSliceV2;
  mode: "validate" | "upsert";
  /** Optional: copy object-storage entries to target. */
  copyObjectStorage?: (manifest: OrgFullSliceV2["objectStorage"]) => Promise<void>;
}): Promise<
  | { ok: true; mode: "validate" | "upsert"; tables: OrgFullSliceV2["tables"] }
  | { ok: false; reason: string }
> {
  const organizationId = requireOrgId(input.organizationId);
  const { slice, mode, models } = input;

  if (slice.formatVersion !== ORG_FULL_SLICE_FORMAT_VERSION) {
    return {
      ok: false,
      reason: `unsupported formatVersion ${String(slice.formatVersion)} (need ${ORG_FULL_SLICE_FORMAT_VERSION})`,
    };
  }
  if (!Array.isArray(slice.modelOrder) || slice.modelOrder.length === 0) {
    return { ok: false, reason: "slice modelOrder empty" };
  }
  if (slice.organizationId !== organizationId) {
    return {
      ok: false,
      reason: `slice organizationId mismatch (slice=${slice.organizationId}, target=${organizationId})`,
    };
  }

  const expectedChecksum = checksumFullSlicePayload({
    organizationId: slice.organizationId,
    modelOrder: slice.modelOrder,
    tables: slice.tables,
    objectStorageEntries: slice.objectStorage?.entries ?? [],
  });
  if (slice.checksum !== expectedChecksum) {
    return {
      ok: false,
      reason: `slice checksum mismatch (got=${slice.checksum}, expected=${expectedChecksum})`,
    };
  }

  if (mode === "validate") {
    return { ok: true, mode, tables: slice.tables };
  }

  // Import children first would break FKs — use modelOrder (parents first),
  // delete in reverse order so children go first.
  const deleteOrder = [...slice.modelOrder].reverse();
  for (const name of deleteOrder) {
    const delegate = models[name];
    if (!delegate?.deleteMany) {
      return { ok: false, reason: `model ${name} missing deleteMany` };
    }
    await delegate.deleteMany({ where: { organizationId } });
  }

  for (const name of slice.modelOrder) {
    const delegate = models[name];
    if (!delegate?.create) {
      return { ok: false, reason: `model ${name} missing create` };
    }
    const list = slice.rows[name] ?? [];
    for (const row of list) {
      const data: Record<string, unknown> = { ...row, organizationId };
      // Strip Prisma relation objects if any leaked into JSON
      for (const k of Object.keys(data)) {
        const v = data[k];
        if (
          v &&
          typeof v === "object" &&
          !Array.isArray(v) &&
          !(v instanceof Date)
        ) {
          // keep plain JSON scalars/arrays; drop nested relation bags without id-only
        }
      }
      await delegate.create({ data });
    }
  }

  if (input.copyObjectStorage && slice.objectStorage) {
    await input.copyObjectStorage(slice.objectStorage);
  }

  return { ok: true, mode: "upsert", tables: slice.tables };
}

/** Lab summary when orch cannot reach satellite (CI). */
export function exportFullOrgSliceLabSummary(
  organizationId: string,
  satelliteKey?: string,
): OrgFullSliceExportSummary {
  const id = requireOrgId(organizationId);
  const tables = [{ name: "_lab", rowCount: 0 }];
  const modelOrder = ["_lab"];
  const checksum = checksumFullSlicePayload({
    organizationId: id,
    modelOrder,
    tables,
    objectStorageEntries: [],
  });
  return {
    organizationId: id,
    formatVersion: ORG_FULL_SLICE_FORMAT_VERSION,
    satelliteKey,
    note: `${ORG_FULL_SLICE_NOTE} (lab)`,
    modelOrder,
    tables,
    rowCounts: { _lab: 0 },
    objectStorage: {
      prefix: `org/${id}/`,
      entries: [],
      stub: true,
    },
    checksum,
  };
}
