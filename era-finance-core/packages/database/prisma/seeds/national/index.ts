import type { SeedContext } from "../_engine/upsert";
import { seedStatReportDefinitions } from "./stat-report-definitions";

/**
 * National layer (Data-Hub Phase 2): tax rates + NAS chart templates owned by hub.
 * Local seed of TaxRate / chart catalog removed; keep finance-owned stat report defs.
 */
export async function seedNational(ctx: SeedContext): Promise<void> {
  if (ctx.region === "AZ") {
    await seedStatReportDefinitions(ctx);
    return;
  }
  console.info(`[seed] national region "${ctx.region}" not implemented, skipping`);
}
