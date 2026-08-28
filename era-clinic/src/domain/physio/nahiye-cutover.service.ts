import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, type ProcedureSiteLaterality } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import type { ImportTx } from "@/lib/import/types";
import {
  bucketOf,
  buildMatcher,
  classifyEmptyNahiye,
  fillImportedNote,
  fold,
  overlayZoneAliases,
  type NahiyeMatchCatalog,
} from "./nahiye-match";
import {
  inferLateralityFromText,
  physioFieldsFromFlags,
  siteApplyModeFromFlags,
  type ListAliasHit,
} from "./nahiye-match-values";
import { deriveCoarseBodyPart, resolveSiteApplyMode, uniqueOrderedIds } from "./physio-order-sites";
import { parseAliasList, PhysioCatalogError } from "./physio-catalog";

let catalogCache: NahiyeMatchCatalog | null = null;

export function loadNahiyeCatalogJson(): NahiyeMatchCatalog {
  if (catalogCache) return catalogCache;
  const p = join(process.cwd(), "prisma", "seed-data", "nafta", "physio-zones-s.json");
  catalogCache = JSON.parse(readFileSync(p, "utf8")) as NahiyeMatchCatalog;
  return catalogCache;
}

export async function enqueueNahiyeResidue(
  tx: ImportTx,
  input: {
    organizationId: string;
    raw: string;
    residue: string;
    bucket: string;
    procedureName?: string | null;
    suggestedSiteCode?: string | null;
    orderId?: string | null;
  },
) {
  if (input.bucket !== "unknown" && input.bucket !== "partial") return;
  const normalizedText = fold(input.raw);
  if (!normalizedText) return;
  const existing = await tx.physioNahiyeQueue.findUnique({
    where: {
      organizationId_normalizedText: {
        organizationId: input.organizationId,
        normalizedText,
      },
    },
  });
  if (existing) {
    await tx.physioNahiyeQueue.update({
      where: { id: existing.id },
      data: {
        hitCount: { increment: 1 },
        lastOrderId: input.orderId ?? existing.lastOrderId,
        sampleProcedureName: input.procedureName ?? existing.sampleProcedureName,
        ...(existing.status === "OPEN" ? { residue: input.residue } : {}),
      },
    });
    return;
  }
  await tx.physioNahiyeQueue.create({
    data: {
      organizationId: input.organizationId,
      normalizedText,
      sampleRaw: input.raw.slice(0, 4000),
      residue: input.residue,
      bucket: input.bucket,
      sampleProcedureName: input.procedureName ?? null,
      suggestedSiteCode: input.suggestedSiteCode ?? null,
      lastOrderId: input.orderId ?? null,
    },
  });
}

export async function applyNahiyeToProcedureOrder(
  tx: ImportTx,
  orderId: string,
  input: {
    nahiye: string | null;
    procedureName: string;
    procedureTypeId?: string | null;
    existingNote?: string | null;
    replaceSites: boolean;
  },
) {
  const organizationId = requestOrganizationId();
  const note = fillImportedNote(input.existingNote, input.nahiye);
  const raw = (input.nahiye ?? "").trim();

  const [dbSites, programs, substances, procType] = await Promise.all([
    tx.physioSite.findMany({
      where: { active: true },
      include: { aliases: true },
    }),
    tx.physioListItem.findMany({
      where: { listKind: "DEVICE_PROGRAM", active: true },
      include: { aliases: true },
    }),
    tx.physioListItem.findMany({
      where: { listKind: "SUBSTANCE", active: true },
      include: { aliases: true },
    }),
    input.procedureTypeId
      ? tx.procedureType.findFirst({ where: { id: input.procedureTypeId } })
      : Promise.resolve(null),
  ]);

  const cat = overlayZoneAliases(loadNahiyeCatalogJson(), dbSites);
  const matcher = buildMatcher(cat);
  let chips: string[] = [];
  let flags: string[] = [];
  let residue = "";
  let bucket = "empty-text";

  if (raw) {
    const m = matcher.match(raw, { procedureName: input.procedureName });
    chips = m.chips;
    flags = m.flags;
    residue = m.residue;
    bucket = bucketOf(m);
  } else if (procType?.needsSite !== false) {
    const empty = classifyEmptyNahiye(input.procedureName);
    chips = empty.defaults;
  }

  const listHits: ListAliasHit[] = [];
  for (const row of [...programs, ...substances]) {
    for (const a of row.aliases) {
      const aliasFold = fold(a.alias);
      if (aliasFold) {
        listHits.push({
          id: row.id,
          listKind: row.listKind as "DEVICE_PROGRAM" | "SUBSTANCE",
          aliasFold,
        });
      }
    }
  }

  const physioFields = raw ? physioFieldsFromFlags(flags, raw, listHits) : {};
  const laterality = raw ? inferLateralityFromText(raw) : null;
  const flaggedMode = siteApplyModeFromFlags(flags);

  const byCode = new Map(dbSites.map((s) => [s.code, s]));
  const orderedCodes = uniqueOrderedIds(chips).filter((c) => byCode.has(c));
  const orderedSites = orderedCodes.map((c) => byCode.get(c)!);
  const bodyPart = deriveCoarseBodyPart(orderedSites);
  const siteApplyMode = resolveSiteApplyMode(orderedSites.length, flaggedMode);

  if (input.replaceSites) {
    await tx.procedureOrderSite.deleteMany({ where: { procedureOrderId: orderId } });
    if (orderedSites.length) {
      await tx.procedureOrderSite.createMany({
        data: orderedSites.map((site, i) => ({
          organizationId,
          procedureOrderId: orderId,
          siteId: site.id,
          sortOrder: i,
          laterality: (site.laterality && laterality ? laterality : null) as ProcedureSiteLaterality | null,
        })),
      });
    }
  }

  await tx.procedureOrder.update({
    where: { id: orderId },
    data: {
      note,
      ...(input.replaceSites
        ? {
            bodyPart,
            siteApplyMode,
            physioFields: physioFields as Prisma.InputJsonValue,
          }
        : {}),
    },
  });

  if (raw) {
    await enqueueNahiyeResidue(tx, {
      organizationId,
      raw,
      residue,
      bucket,
      procedureName: input.procedureName,
      suggestedSiteCode: orderedCodes[0] ?? null,
      orderId,
    });
  }
}

export async function listNahiyeQueue(opts?: { q?: string; status?: string }) {
  const organizationId = requestOrganizationId();
  const q = opts?.q?.trim();
  const status = opts?.status?.trim().toUpperCase();
  return prisma.physioNahiyeQueue.findMany({
    where: {
      organizationId,
      ...(status && ["OPEN", "RESOLVED", "NOT_ANATOMY"].includes(status)
        ? { status: status as "OPEN" | "RESOLVED" | "NOT_ANATOMY" }
        : { status: "OPEN" }),
      ...(q
        ? {
            OR: [
              { sampleRaw: { contains: q, mode: "insensitive" } },
              { residue: { contains: q, mode: "insensitive" } },
              { sampleProcedureName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ hitCount: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
}

export async function ignoreNahiyeQueueItem(id: string) {
  const organizationId = requestOrganizationId();
  const row = await prisma.physioNahiyeQueue.findFirst({ where: { id, organizationId } });
  if (!row) throw new PhysioCatalogError("Queue row not found", 404);
  return prisma.physioNahiyeQueue.update({
    where: { id },
    data: { status: "NOT_ANATOMY" },
  });
}

export async function aliasNahiyeQueueItem(id: string, siteId: string, aliasText?: string) {
  const organizationId = requestOrganizationId();
  const row = await prisma.physioNahiyeQueue.findFirst({ where: { id, organizationId } });
  if (!row) throw new PhysioCatalogError("Queue row not found", 404);
  const site = await prisma.physioSite.findFirst({
    where: { id: siteId, organizationId },
    include: { aliases: true },
  });
  if (!site) throw new PhysioCatalogError("Unknown physio site", 400);
  const extra = parseAliasList([aliasText || row.residue || row.sampleRaw]);
  if (!extra.length) throw new PhysioCatalogError("Alias is empty", 400);
  const have = new Set(site.aliases.map((a) => a.alias));
  const create = extra.filter((a) => !have.has(a));
  if (create.length) {
    try {
      await prisma.physioSiteAlias.createMany({
        data: create.map((alias) => ({ organizationId, siteId, alias })),
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new PhysioCatalogError("Alias already exists on another site", 409);
      }
      throw err;
    }
  }
  return prisma.physioNahiyeQueue.update({
    where: { id },
    data: { status: "RESOLVED", suggestedSiteCode: site.code },
  });
}
