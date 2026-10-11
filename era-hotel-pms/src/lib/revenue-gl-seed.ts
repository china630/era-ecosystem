/**
 * Opening GL accounts written into HotelRevenueGlMapping by seed only.
 * Night audit and the settings list read the saved row. They do not use this table.
 */
import type { PrismaClient } from "@prisma/client";

const STARTER_GL_BY_TOKEN: Record<string, string> = {
  ROOM: "601",
  FOOD: "602",
  MEDICAL: "603",
  PKG: "601",
  TREATMENT: "604",
  BOARD: "605",
  TRANSFER: "606",
  TOUR: "606",
};

const UNLISTED_GL_ACCOUNT = "601";

export function starterGlAccount(code: string, name: string): string {
  for (const token of [code, name]) {
    const hit = STARTER_GL_BY_TOKEN[token.trim().toUpperCase()];
    if (hit) return hit;
  }
  return UNLISTED_GL_ACCOUNT;
}

/** Insert a mapping when the revenue code has none. Does not overwrite a saved account. */
export async function ensureRevenueGlSeedRows(db: PrismaClient): Promise<number> {
  const codes = await db.revenueCode.findMany({
    select: { id: true, code: true, name: true },
  });
  for (const code of codes) {
    await db.hotelRevenueGlMapping.upsert({
      where: { revenueCodeId: code.id },
      create: {
        revenueCodeId: code.id,
        glAccountCode: starterGlAccount(code.code, code.name),
      },
      update: {},
    });
  }
  return codes.length;
}
