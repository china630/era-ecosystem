import { prisma } from "@/lib/prisma";
import {
  formatIcdLabel,
  IcdCatalogError,
  normalizeIcdLocale,
  type IcdLocale,
} from "@/domain/icd/icd-catalog";

export async function searchSelectableIcd(input: {
  q?: string;
  chapter?: string;
  locale?: string;
  take?: number;
  favoriteCodes?: string[];
}) {
  const locale = normalizeIcdLocale(input.locale);
  const take = Math.min(Math.max(input.take ?? 20, 1), 50);
  const q = input.q?.trim() ?? "";
  const chapter = input.chapter?.trim() || undefined;
  const favorites = (input.favoriteCodes ?? []).filter(Boolean);

  const where = {
    selectable: true,
    active: true,
    ...(chapter ? { chapterCode: chapter } : {}),
    ...(q
      ? {
          OR: [
            { code: { startsWith: q, mode: "insensitive" as const } },
            { searchText: { contains: q.toLowerCase(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [favRows, rest] = await Promise.all([
    favorites.length && !q
      ? prisma.icdCode.findMany({
          where: { ...where, code: { in: favorites } },
          take,
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
    prisma.icdCode.findMany({
      where,
      take: take + favorites.length,
      orderBy: { code: "asc" },
    }),
  ]);

  const seen = new Set<string>();
  const merged = [];
  for (const row of [...favRows, ...rest]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length >= take) break;
  }

  return {
    locale,
    items: merged.map((row) => ({
      id: row.id,
      code: row.code,
      kind: row.kind,
      chapterCode: row.chapterCode,
      title: formatIcdLabel(row, locale),
      titleEn: row.titleEn,
      titleRu: row.titleRu,
      titleAz: row.titleAz,
      favorite: favorites.includes(row.code),
    })),
  };
}

export async function listIcdChapters(locale?: string) {
  const loc = normalizeIcdLocale(locale);
  const rows = await prisma.icdCode.findMany({
    where: { kind: "CHAPTER", active: true },
    orderBy: { code: "asc" },
  });
  const romanOrder = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    "XXI", "XXII",
  ];
  rows.sort((a, b) => romanOrder.indexOf(a.code) - romanOrder.indexOf(b.code));
  return rows.map((row) => ({
    code: row.code,
    title: formatIcdLabel(row, loc),
  }));
}

export async function requireSelectableIcd(icdCodeId: string) {
  const row = await prisma.icdCode.findUnique({ where: { id: icdCodeId } });
  if (!row) throw new IcdCatalogError("ICD-10 code not found", 400);
  if (!row.active) throw new IcdCatalogError("ICD-10 code is inactive", 400);
  if (!row.selectable) {
    throw new IcdCatalogError("Only a selectable ICD-10 category or leaf may be recorded", 400);
  }
  return row;
}

export async function getTenantIcdFavorites(): Promise<string[]> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  return tenant?.icdFavoriteCodes ?? [];
}

export async function setTenantIcdFavorites(codes: string[]) {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) throw new IcdCatalogError("Tenant not found", 404);
  return prisma.tenant.update({
    where: { id: tenant.id },
    data: { icdFavoriteCodes: unique },
  });
}

/** Soft-retire a code; historical FK rows keep titles via catalog row. */
export async function retireIcdCode(code: string) {
  const row = await prisma.icdCode.findUnique({ where: { code: code.trim() } });
  if (!row) throw new IcdCatalogError("ICD-10 code not found", 404);
  return prisma.icdCode.update({
    where: { id: row.id },
    data: { active: false, retiredAt: new Date() },
  });
}
