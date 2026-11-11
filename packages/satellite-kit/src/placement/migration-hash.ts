/**
 * Prisma migration fingerprint for placement hop — source and target must match.
 */

import { createHash } from "node:crypto";

export type PrismaMigrationQueryClient = {
  $queryRawUnsafe: <T = unknown>(
    query: string,
    ...values: unknown[]
  ) => Promise<T>;
};

export async function listFinishedPrismaMigrationNames(
  prisma: PrismaMigrationQueryClient,
): Promise<string[]> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "migration_name" AS name FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL ORDER BY "migration_name" ASC`,
    )) as Array<{ name: string }>;
    return rows
      .map((r) => (typeof r.name === "string" ? r.name.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Short stable fingerprint of applied Prisma migrations (sha256 hex prefix). */
export function fingerprintMigrationNames(names: string[]): string {
  const payload = [...names].sort().join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 24);
}

export async function computePrismaMigrationHash(
  prisma: PrismaMigrationQueryClient,
): Promise<{ hash: string; migrationCount: number; names: string[] }> {
  const names = await listFinishedPrismaMigrationNames(prisma);
  return {
    hash: fingerprintMigrationNames(names),
    migrationCount: names.length,
    names,
  };
}

export function migrationHashesMatch(
  sourceHash: string | null | undefined,
  targetHash: string | null | undefined,
): boolean {
  const a = sourceHash?.trim() || "";
  const b = targetHash?.trim() || "";
  if (!a || !b) return false;
  return a === b;
}
