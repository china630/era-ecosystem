import { prisma } from "@/lib/prisma";
import { getRouteSession, jsonError } from "@/lib/api-utils";
import { fetchSubscriptionSnapshot, hasActiveModule } from "@era/satellite-kit";

const BANK_ORG_ID =
  process.env.ERA_BANK_ORGANIZATION_ID ??
  process.env.ERA_SATELLITE_ORGANIZATION_ID ??
  "";

const BANKING_MODULES = [
  "industry_banking",
  "banking_core",
  "banking_payments",
  "banking_deposits",
  "banking_loans",
  "banking_aml",
  "banking_cards",
  "banking_treasury",
  "banking_regreporting",
] as const;

export async function GET() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);

  if (!BANK_ORG_ID || process.env.NODE_ENV !== "production") {
    return Response.json({ modules: [...BANKING_MODULES] });
  }

  const snapshot = await fetchSubscriptionSnapshot(BANK_ORG_ID);
  if (!snapshot) {
    return Response.json({ modules: ["industry_banking"] });
  }

  const modules = BANKING_MODULES.filter((m) => hasActiveModule(snapshot, m));
  return Response.json({ modules });
}
