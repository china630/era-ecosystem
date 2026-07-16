import type { SeedContext } from "../_engine/upsert";

/**
 * Geo catalogs owned by era-data-hub (Phase 2).
 * Country / City kept as hub-sync FK cache — not seeded here.
 */
export async function seedGeo(ctx: SeedContext): Promise<void> {
  console.info(
    `[seed] geo layer skipped (hub SoR; dryRun=${ctx.dryRun}) — sync geo via data-hub`,
  );
}
