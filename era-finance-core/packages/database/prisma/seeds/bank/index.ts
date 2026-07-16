import type { SeedContext } from "../_engine/upsert";

/**
 * Bank glossary/branches owned by era-data-hub (Phase 2).
 * BankGlossary / BankBranch kept as hub-sync FK cache — not seeded here.
 */
export async function seedBank(ctx: SeedContext): Promise<void> {
  console.info(
    `[seed] bank layer skipped (hub SoR; dryRun=${ctx.dryRun}) — sync banks via data-hub`,
  );
}
