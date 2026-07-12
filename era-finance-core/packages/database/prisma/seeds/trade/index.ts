import type { SeedContext } from "../_engine/upsert";

/**
 * Trade catalogs (UoM, HS, customs tariffs) owned by era-data-hub (Phase 2).
 * UnitOfMeasure table kept as hub-sync FK cache — not seeded here.
 */
export async function seedTrade(ctx: SeedContext): Promise<void> {
  console.info(
    `[seed] trade layer skipped (hub SoR; dryRun=${ctx.dryRun}) — sync UoM via data-hub`,
  );
}
