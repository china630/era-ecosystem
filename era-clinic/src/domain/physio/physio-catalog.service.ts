import { Prisma, type PhysioListKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inactiveCatalogDenied } from "@/lib/master-data-gates";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  PhysioCatalogError,
  assertPhysioCode,
  parseAliasList,
  parseCoarse,
  parseSiteKind,
  type PhysioListKindCode,
} from "./physio-catalog";

const siteInclude = { aliases: { orderBy: { alias: "asc" as const } } };
const itemInclude = { aliases: { orderBy: { alias: "asc" as const } } };

function orgId(): string {
  return requestOrganizationId();
}

function asUniqueConflict(err: unknown, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new PhysioCatalogError(message, 409);
  }
  throw err;
}

export type PhysioSiteInput = {
  code: string;
  kind: string;
  prikaz817?: number | null;
  laterality?: boolean;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  titleLa: string;
  boundary?: string | null;
  coarse: string[];
  anatomyJson?: string | null;
  sortOrder?: number;
  aliases?: string[];
  active?: boolean;
};

export type PhysioListItemInput = {
  listKind: PhysioListKindCode;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  sortOrder?: number;
  aliases?: string[];
  active?: boolean;
};

export async function listPhysioSites(opts?: { q?: string; activeOnly?: boolean }) {
  const q = opts?.q?.trim();
  return prisma.physioSite.findMany({
    where: {
      ...(opts?.activeOnly ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { titleEn: { contains: q, mode: "insensitive" } },
              { titleAz: { contains: q, mode: "insensitive" } },
              { titleRu: { contains: q, mode: "insensitive" } },
              { titleLa: { contains: q, mode: "insensitive" } },
              { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: siteInclude,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getPhysioSite(id: string) {
  const row = await prisma.physioSite.findFirst({ where: { id }, include: siteInclude });
  if (!row) throw new PhysioCatalogError("Physio site not found", 404);
  return row;
}

export async function createPhysioSite(input: PhysioSiteInput) {
  const code = assertPhysioCode(input.code);
  const kind = parseSiteKind(input.kind);
  const coarse = parseCoarse(input.coarse);
  const aliases = parseAliasList(input.aliases);
  const organizationId = orgId();
  try {
    return await prisma.physioSite.create({
      data: {
        organizationId,
        code,
        kind,
        prikaz817: input.prikaz817 ?? null,
        laterality: Boolean(input.laterality),
        titleAz: input.titleAz.trim(),
        titleRu: input.titleRu.trim(),
        titleEn: input.titleEn.trim(),
        titleLa: input.titleLa.trim(),
        boundary: input.boundary?.trim() || null,
        coarse,
        anatomyJson: input.anatomyJson ?? null,
        sortOrder: input.sortOrder ?? 0,
        aliases: {
          create: aliases.map((alias) => ({ organizationId, alias })),
        },
      },
      include: siteInclude,
    });
  } catch (err) {
    asUniqueConflict(err, "Site code or alias already exists");
  }
}

export async function updatePhysioSite(id: string, input: Partial<PhysioSiteInput>) {
  await getPhysioSite(id);
  const organizationId = orgId();
  const data: Prisma.PhysioSiteUpdateInput = {};
  if (input.kind !== undefined) data.kind = parseSiteKind(input.kind);
  if (input.prikaz817 !== undefined) data.prikaz817 = input.prikaz817;
  if (input.laterality !== undefined) data.laterality = input.laterality;
  if (input.titleAz !== undefined) data.titleAz = input.titleAz.trim();
  if (input.titleRu !== undefined) data.titleRu = input.titleRu.trim();
  if (input.titleEn !== undefined) data.titleEn = input.titleEn.trim();
  if (input.titleLa !== undefined) data.titleLa = input.titleLa.trim();
  if (input.boundary !== undefined) data.boundary = input.boundary?.trim() || null;
  if (input.coarse !== undefined) data.coarse = parseCoarse(input.coarse);
  if (input.anatomyJson !== undefined) data.anatomyJson = input.anatomyJson;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.active !== undefined) data.active = input.active;

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.aliases !== undefined) {
        const aliases = parseAliasList(input.aliases);
        await tx.physioSiteAlias.deleteMany({ where: { siteId: id } });
        if (aliases.length) {
          await tx.physioSiteAlias.createMany({
            data: aliases.map((alias) => ({ organizationId, siteId: id, alias })),
          });
        }
      }
      return tx.physioSite.update({ where: { id }, data, include: siteInclude });
    });
  } catch (err) {
    asUniqueConflict(err, "Site code or alias already exists");
  }
}

/** Retire — never hard-delete S. */
export async function retirePhysioSite(id: string) {
  await getPhysioSite(id);
  return prisma.physioSite.update({
    where: { id },
    data: { active: false },
    include: siteInclude,
  });
}

export function assertPhysioSiteActive(active: boolean): void {
  const msg = inactiveCatalogDenied(active, "Physio site");
  if (msg) throw new PhysioCatalogError(msg, 409);
}

export async function listPhysioListItems(
  listKind: PhysioListKindCode,
  opts?: { q?: string; activeOnly?: boolean },
) {
  const q = opts?.q?.trim();
  return prisma.physioListItem.findMany({
    where: {
      listKind: listKind as PhysioListKind,
      ...(opts?.activeOnly ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { titleEn: { contains: q, mode: "insensitive" } },
              { titleAz: { contains: q, mode: "insensitive" } },
              { titleRu: { contains: q, mode: "insensitive" } },
              { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: itemInclude,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getPhysioListItem(id: string) {
  const row = await prisma.physioListItem.findFirst({ where: { id }, include: itemInclude });
  if (!row) throw new PhysioCatalogError("Physio list item not found", 404);
  return row;
}

export async function createPhysioListItem(input: PhysioListItemInput) {
  const code = assertPhysioCode(input.code);
  const aliases = parseAliasList(input.aliases);
  const organizationId = orgId();
  try {
    return await prisma.physioListItem.create({
      data: {
        organizationId,
        listKind: input.listKind,
        code,
        titleAz: input.titleAz.trim(),
        titleRu: input.titleRu.trim(),
        titleEn: input.titleEn.trim(),
        sortOrder: input.sortOrder ?? 0,
        aliases: {
          create: aliases.map((alias) => ({
            organizationId,
            listKind: input.listKind,
            alias,
          })),
        },
      },
      include: itemInclude,
    });
  } catch (err) {
    asUniqueConflict(err, "List item code or alias already exists");
  }
}

export async function updatePhysioListItem(id: string, input: Partial<Omit<PhysioListItemInput, "listKind" | "code">>) {
  const existing = await getPhysioListItem(id);
  const organizationId = orgId();
  const data: Prisma.PhysioListItemUpdateInput = {};
  if (input.titleAz !== undefined) data.titleAz = input.titleAz.trim();
  if (input.titleRu !== undefined) data.titleRu = input.titleRu.trim();
  if (input.titleEn !== undefined) data.titleEn = input.titleEn.trim();
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.active !== undefined) data.active = input.active;

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.aliases !== undefined) {
        const aliases = parseAliasList(input.aliases);
        await tx.physioListAlias.deleteMany({ where: { itemId: id } });
        if (aliases.length) {
          await tx.physioListAlias.createMany({
            data: aliases.map((alias) => ({
              organizationId,
              itemId: id,
              listKind: existing.listKind,
              alias,
            })),
          });
        }
      }
      return tx.physioListItem.update({ where: { id }, data, include: itemInclude });
    });
  } catch (err) {
    asUniqueConflict(err, "List item code or alias already exists");
  }
}

export async function retirePhysioListItem(id: string) {
  await getPhysioListItem(id);
  return prisma.physioListItem.update({
    where: { id },
    data: { active: false },
    include: itemInclude,
  });
}

export async function getActivePhysioCatalog() {
  const [sites, programs, substances] = await Promise.all([
    listPhysioSites({ activeOnly: true }),
    listPhysioListItems("DEVICE_PROGRAM", { activeOnly: true }),
    listPhysioListItems("SUBSTANCE", { activeOnly: true }),
  ]);
  return { sites, programs, substances };
}
