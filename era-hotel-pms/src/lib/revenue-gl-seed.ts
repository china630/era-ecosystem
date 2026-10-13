/**
 * Opening GL accounts written into HotelRevenueGlMapping by seed only.
 * Night audit and the settings list read the saved row. They do not use this table.
 */
import type { PrismaClient } from "@prisma/client";

/** Operating revenue stays on 601 until a subaccount is saved. Does not use 602–606. */
const OPENING_GL_ACCOUNT = "601";

export function starterGlAccount(_code: string, _name: string): string {
  return OPENING_GL_ACCOUNT;
}

/** Insert a mapping when the revenue code has none. Does not overwrite a saved account. */
export async function ensureRevenueGlSeedRows(db: PrismaClient): Promise<number> {
  const codes = await db.revenueCode.findMany({
    select: { id: true, code: true, name: true, organizationId: true },
  });
  for (const code of codes) {
    await db.hotelRevenueGlMapping.upsert({
      where: { revenueCodeId: code.id },
      create: {
        organizationId: code.organizationId,
        revenueCodeId: code.id,
        glAccountCode: starterGlAccount(code.code, code.name),
      },
      update: {},
    });
  }
  return codes.length;
}
