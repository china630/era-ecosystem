import { z } from "zod";
import { prisma } from "@/lib/prisma";

const procedureSchema = z.object({
  procedureCode: z.string().min(1),
  procedureName: z.string().min(1),
  quotaTotal: z.number().int().positive(),
  avoidAfterHour: z.number().int().optional(),
  kind: z
    .enum(["PHYSIO", "BATH", "PARAFFIN", "LAB", "EXAM", "CUSTOM"])
    .nullable()
    .optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  memberCodes: z.array(z.string().min(1)).optional(),
});

const knotSchema = z.object({
  nights: z.number().int().positive(),
  procedureCode: z.string().min(1),
  qty: z.number().int().nonnegative(),
});

export const programTemplateWriteSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  minNights: z.number().int().positive().nullable().optional(),
  maxNights: z.number().int().positive().nullable().optional(),
  procedures: z.array(procedureSchema).optional(),
  knots: z.array(knotSchema).optional(),
});

export const programTemplateCreateSchema = programTemplateWriteSchema.extend({
  code: z.string().min(1),
  name: z.string().min(1),
  durationDays: z.number().int().positive(),
  procedures: z.array(procedureSchema).default([]),
});

export type ProgramProcedureInput = z.infer<typeof procedureSchema>;
export type ProgramKnotInput = z.infer<typeof knotSchema>;

export const programTemplateInclude = {
  procedures: { orderBy: [{ sortOrder: "asc" as const }, { procedureCode: "asc" as const }] },
  quotaKnots: true,
  blockMembers: true,
} as const;

export type EntitlementSnapshot = {
  version: number;
  templateId: string;
  code: string;
  procedures: Array<{
    procedureCode: string;
    procedureName: string;
    quotaTotal: number;
    kind?: string | null;
    sortOrder?: number;
  }>;
  knots: Array<{ nights: number; procedureCode: string; qty: number }>;
  members: Array<{ blockCode: string; procedureCode: string }>;
};

export function shapeProgramTemplate<
  T extends {
    procedures: Array<{
      procedureCode: string;
      procedureName: string;
      quotaTotal: number;
      avoidAfterHour?: number | null;
      kind?: string | null;
      sortOrder?: number;
    }>;
    quotaKnots: unknown;
    blockMembers: Array<{ blockCode: string; procedureCode: string }>;
    openInstanceCount?: number;
  },
>(row: T) {
  const membersByBlock = new Map<string, string[]>();
  for (const m of row.blockMembers) {
    const arr = membersByBlock.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    membersByBlock.set(m.blockCode, arr);
  }
  return {
    ...row,
    procedures: row.procedures.map((p) => ({
      ...p,
      memberCodes: membersByBlock.get(p.procedureCode) ?? [],
    })),
  };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Current (sellable) template for a product code — new check-ins. */
export async function findCurrentProgramTemplate(code: string, tx: Tx | typeof prisma = prisma) {
  return tx.programTemplate.findFirst({
    where: { code, isCurrent: true, retiredAt: null },
    include: programTemplateInclude,
    orderBy: { version: "desc" },
  });
}

export function buildEntitlementSnapshot(input: {
  templateId: string;
  code: string;
  version: number;
  procedures: Array<{
    procedureCode: string;
    procedureName: string;
    quotaTotal: number;
    kind?: string | null;
    sortOrder?: number;
  }>;
  knots?: Array<{ nights: number; procedureCode: string; qty: number }> | null;
  members?: Array<{ blockCode: string; procedureCode: string }> | null;
}): EntitlementSnapshot {
  return {
    version: input.version,
    templateId: input.templateId,
    code: input.code,
    procedures: input.procedures.map((p) => ({
      procedureCode: p.procedureCode,
      procedureName: p.procedureName,
      quotaTotal: p.quotaTotal,
      kind: p.kind ?? null,
      sortOrder: p.sortOrder ?? 0,
    })),
    knots: (input.knots ?? []).map((k) => ({
      nights: k.nights,
      procedureCode: k.procedureCode,
      qty: k.qty,
    })),
    members: (input.members ?? []).map((m) => ({
      blockCode: m.blockCode,
      procedureCode: m.procedureCode,
    })),
  };
}

export function parseEntitlementSnapshot(raw: unknown): EntitlementSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "number") return null;
  if (!Array.isArray(o.members) || !Array.isArray(o.procedures)) return null;
  return raw as EntitlementSnapshot;
}

/** Prefer snapshot whenever present (including empty members = frozen heuristic/empty whitelist). */
export function resolveMembersByBlock(input: {
  entitlementSnapshot: unknown;
  templateMembers: Array<{ blockCode: string; procedureCode: string }>;
}): Map<string, string[]> {
  const snap = parseEntitlementSnapshot(input.entitlementSnapshot);
  if (snap) return membersMapFromSnapshot(snap);
  const map = new Map<string, string[]>();
  for (const m of input.templateMembers) {
    const arr = map.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    map.set(m.blockCode, arr);
  }
  return map;
}

export function membersMapFromSnapshot(
  snap: EntitlementSnapshot | null,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!snap) return map;
  for (const m of snap.members) {
    const arr = map.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    map.set(m.blockCode, arr);
  }
  return map;
}

export async function replaceTemplateProceduresAndKnots(
  tx: Tx,
  templateId: string,
  procedures: ProgramProcedureInput[],
  knots: ProgramKnotInput[] | undefined,
) {
  await tx.programTemplateBlockMember.deleteMany({ where: { templateId } });
  await tx.programTemplateProcedure.deleteMany({ where: { templateId } });
  if (procedures.length > 0) {
    await tx.programTemplateProcedure.createMany({
      data: procedures.map((p, i) => ({
        templateId,
        procedureCode: p.procedureCode,
        procedureName: p.procedureName,
        quotaTotal: p.quotaTotal,
        avoidAfterHour: p.avoidAfterHour ?? null,
        kind: p.kind ?? null,
        sortOrder: p.sortOrder ?? i,
      })),
    });
    const memberRows: Array<{ templateId: string; blockCode: string; procedureCode: string }> =
      [];
    for (const p of procedures) {
      for (const code of p.memberCodes ?? []) {
        memberRows.push({
          templateId,
          blockCode: p.procedureCode,
          procedureCode: code,
        });
      }
    }
    if (memberRows.length > 0) {
      await tx.programTemplateBlockMember.createMany({ data: memberRows });
    }
  }
  if (knots) {
    await tx.programTemplateQuotaKnot.deleteMany({ where: { templateId } });
    if (knots.length > 0) {
      await tx.programTemplateQuotaKnot.createMany({
        data: knots.map((k) => ({
          templateId,
          nights: k.nights,
          procedureCode: k.procedureCode,
          qty: k.qty,
        })),
      });
    }
  }
}

function compositionFingerprint(
  procedures: ProgramProcedureInput[],
  knots: ProgramKnotInput[] | undefined,
): string {
  const procs = [...procedures]
    .map((p) => ({
      procedureCode: p.procedureCode,
      procedureName: p.procedureName,
      quotaTotal: p.quotaTotal,
      kind: p.kind ?? null,
      sortOrder: p.sortOrder ?? 0,
      memberCodes: [...(p.memberCodes ?? [])].sort(),
    }))
    .sort((a, b) => a.procedureCode.localeCompare(b.procedureCode));
  const ks = [...(knots ?? [])]
    .map((k) => ({ nights: k.nights, procedureCode: k.procedureCode, qty: k.qty }))
    .sort((a, b) =>
      `${a.nights}:${a.procedureCode}`.localeCompare(`${b.nights}:${b.procedureCode}`),
    );
  return JSON.stringify({ procs, ks });
}

export function compositionChanged(
  existing: {
    procedures: Array<{
      procedureCode: string;
      procedureName: string;
      quotaTotal: number;
      kind?: string | null;
      sortOrder?: number;
      memberCodes?: string[];
    }>;
    quotaKnots: Array<{ nights: number; procedureCode: string; qty: number }>;
    blockMembers: Array<{ blockCode: string; procedureCode: string }>;
  },
  procedures: ProgramProcedureInput[],
  knots: ProgramKnotInput[] | undefined,
): boolean {
  const shaped = shapeProgramTemplate(existing);
  const before = compositionFingerprint(
    shaped.procedures.map((p) => ({
      procedureCode: p.procedureCode,
      procedureName: p.procedureName,
      quotaTotal: p.quotaTotal,
      kind: (p.kind as ProgramProcedureInput["kind"]) ?? null,
      sortOrder: p.sortOrder,
      memberCodes: p.memberCodes,
    })),
    existing.quotaKnots,
  );
  const after = compositionFingerprint(procedures, knots ?? existing.quotaKnots);
  return before !== after;
}

/** Name / duration / min-max — contract fields that must not mutate a pinned row. */
export function contractMetaChanged(
  existing: {
    name: string;
    durationDays: number;
    minNights: number | null;
    maxNights: number | null;
  },
  body: {
    name?: string;
    durationDays?: number;
    minNights?: number | null;
    maxNights?: number | null;
  },
): boolean {
  if (body.name !== undefined && body.name !== existing.name) return true;
  if (body.durationDays !== undefined && body.durationDays !== existing.durationDays) return true;
  if (body.minNights !== undefined && body.minNights !== existing.minNights) return true;
  if (body.maxNights !== undefined && body.maxNights !== existing.maxNights) return true;
  return false;
}

export async function countOpenInstancesForTemplate(templateId: string, tx: Tx | typeof prisma = prisma) {
  return tx.programInstance.count({
    where: {
      templateId,
      episode: { status: "OPEN" },
    },
  });
}

export async function countAnyInstancesForTemplate(templateId: string, tx: Tx | typeof prisma = prisma) {
  return tx.programInstance.count({ where: { templateId } });
}

function proceduresFromExisting(existing: {
  procedures: Array<{
    procedureCode: string;
    procedureName: string;
    quotaTotal: number;
    avoidAfterHour?: number | null;
    kind?: string | null;
    sortOrder?: number;
  }>;
  blockMembers: Array<{ blockCode: string; procedureCode: string }>;
}): ProgramProcedureInput[] {
  const shaped = shapeProgramTemplate(existing);
  return shaped.procedures.map((p) => ({
    procedureCode: p.procedureCode,
    procedureName: p.procedureName,
    quotaTotal: p.quotaTotal,
    avoidAfterHour: p.avoidAfterHour ?? undefined,
    kind: (p.kind as ProgramProcedureInput["kind"]) ?? null,
    sortOrder: p.sortOrder,
    memberCodes: p.memberCodes,
  }));
}

async function bumpTemplateVersion(
  tx: Tx,
  existing: {
    id: string;
    code: string;
    name: string;
    durationDays: number;
    minNights: number | null;
    maxNights: number | null;
    version: number;
  },
  next: {
    name: string;
    durationDays: number;
    minNights: number | null;
    maxNights: number | null;
    procedures: ProgramProcedureInput[];
    knots: ProgramKnotInput[];
  },
) {
  await tx.programTemplate.update({
    where: { id: existing.id },
    data: { isCurrent: false, retiredAt: new Date() },
  });
  const created = await tx.programTemplate.create({
    data: {
      code: existing.code,
      name: next.name,
      durationDays: next.durationDays,
      minNights: next.minNights,
      maxNights: next.maxNights,
      version: existing.version + 1,
      isCurrent: true,
      retiredAt: null,
      supersedesId: existing.id,
    },
  });
  await replaceTemplateProceduresAndKnots(tx, created.id, next.procedures, next.knots);
  return tx.programTemplate.findUniqueOrThrow({
    where: { id: created.id },
    include: programTemplateInclude,
  });
}

/**
 * If the current template has any ProgramInstance pins, clone to a new version
 * before mutating composition (seed / cutover import safety).
 */
export async function ensureWritableCurrentTemplate(
  tx: Tx,
  templateId: string,
): Promise<string> {
  const existing = await tx.programTemplate.findUnique({
    where: { id: templateId },
    include: programTemplateInclude,
  });
  if (!existing) throw new Error(`Program template ${templateId} not found`);
  if (!existing.isCurrent) {
    throw new Error(`Program template ${templateId} is not current`);
  }
  const pinned = await countAnyInstancesForTemplate(templateId, tx);
  if (pinned === 0) return templateId;

  const procs = proceduresFromExisting(existing);
  const knots = existing.quotaKnots.map((k) => ({
    nights: k.nights,
    procedureCode: k.procedureCode,
    qty: k.qty,
  }));
  const created = await bumpTemplateVersion(tx, existing, {
    name: existing.name,
    durationDays: existing.durationDays,
    minNights: existing.minNights,
    maxNights: existing.maxNights,
    procedures: procs,
    knots,
  });
  return created.id;
}

/**
 * Apply admin PATCH: any contract change (composition OR name/duration/min/max)
 * creates a new version; pinned instances keep the retired row untouched.
 */
export async function saveProgramTemplatePatch(
  id: string,
  body: z.infer<typeof programTemplateWriteSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.programTemplate.findUnique({
      where: { id },
      include: programTemplateInclude,
    });
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { code?: string }).code = "NOT_FOUND";
      throw err;
    }
    if (!existing.isCurrent || existing.retiredAt) {
      const err = new Error("RETIRED_TEMPLATE");
      (err as Error & { code?: string }).code = "RETIRED_TEMPLATE";
      throw err;
    }

    if (body.knots && !body.procedures) {
      const err = new Error("COMPOSITION_REQUIRES_PROCEDURES");
      (err as Error & { code?: string }).code = "COMPOSITION_REQUIRES_PROCEDURES";
      throw err;
    }

    const metaChanged = contractMetaChanged(existing, body);
    const nextName = body.name ?? existing.name;
    const nextDuration = body.durationDays ?? existing.durationDays;
    const nextMin = body.minNights !== undefined ? body.minNights : existing.minNights;
    const nextMax = body.maxNights !== undefined ? body.maxNights : existing.maxNights;

    const existingProcs = proceduresFromExisting(existing);
    const existingKnots = existing.quotaKnots.map((k) => ({
      nights: k.nights,
      procedureCode: k.procedureCode,
      qty: k.qty,
    }));

    let nextProcs = existingProcs;
    let nextKnots = existingKnots;
    let compChanged = false;

    if (body.procedures) {
      nextProcs = body.procedures;
      nextKnots = body.knots ?? existingKnots;
      compChanged = compositionChanged(existing, nextProcs, nextKnots);
    }

    if (!metaChanged && !compChanged) {
      return existing;
    }

    return bumpTemplateVersion(tx, existing, {
      name: nextName,
      durationDays: nextDuration,
      minNights: nextMin,
      maxNights: nextMax,
      procedures: nextProcs,
      knots: nextKnots,
    });
  });
}

/** Delete retired versions that no guest instance pins (optional age filter). */
export async function purgeRetiredTemplatesWithoutInstances(opts?: {
  olderThanDays?: number;
}): Promise<{ deleted: number; ids: string[] }> {
  const olderThanDays = opts?.olderThanDays ?? 0;
  const cutoff =
    olderThanDays > 0
      ? new Date(Date.now() - olderThanDays * 86400000)
      : null;

  const retired = await prisma.programTemplate.findMany({
    where: {
      isCurrent: false,
      ...(cutoff ? { retiredAt: { lte: cutoff } } : { retiredAt: { not: null } }),
    },
    select: { id: true },
  });
  const ids: string[] = [];
  for (const row of retired) {
    const n = await countAnyInstancesForTemplate(row.id);
    if (n === 0) {
      await prisma.programTemplate.delete({ where: { id: row.id } });
      ids.push(row.id);
    }
  }
  return { deleted: ids.length, ids };
}

/** Backfill entitlementSnapshot for instances that still lack one. */
export async function backfillEntitlementSnapshots(): Promise<{ updated: number }> {
  const missing = await prisma.programInstance.findMany({
    where: { entitlementSnapshot: null },
    select: { id: true, templateId: true },
  });
  let updated = 0;
  for (const row of missing) {
    const template = await prisma.programTemplate.findUnique({
      where: { id: row.templateId },
      include: programTemplateInclude,
    });
    if (!template) continue;
    const snapshot = buildEntitlementSnapshot({
      templateId: template.id,
      code: template.code,
      version: template.version,
      procedures: template.procedures,
      knots: template.quotaKnots,
      members: template.blockMembers,
    });
    await prisma.programInstance.update({
      where: { id: row.id },
      data: { entitlementSnapshot: snapshot },
    });
    updated += 1;
  }
  return { updated };
}

export { procedureSchema, knotSchema };
