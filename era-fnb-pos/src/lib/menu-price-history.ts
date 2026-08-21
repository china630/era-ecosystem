import type { Prisma, PrismaClient } from "@prisma/client";
import type { SatelliteTransactionClient } from "@era/satellite-kit/tenancy";

type Db = PrismaClient | Prisma.TransactionClient | SatelliteTransactionClient;

/** Close open price row and insert current price (call inside txn when creating/updating price). */
export async function recordMenuItemPrice(
  db: Db,
  menuItemId: string,
  priceAzn: number | string,
  opts?: { effectiveFrom?: Date; reason?: string | null; createdBy?: string | null },
) {
  const now = opts?.effectiveFrom ?? new Date();
  await db.menuItemPrice.updateMany({
    where: { menuItemId, effectiveTo: null },
    data: { effectiveTo: now },
  });
  return db.menuItemPrice.create({
    data: {
      menuItemId,
      priceAzn,
      effectiveFrom: now,
      reason: opts?.reason ?? null,
      createdBy: opts?.createdBy ?? null,
    },
  });
}
