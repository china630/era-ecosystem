/**
 * Billing reconciliation on control plane DB (post CP-BILLING cutover).
 * Usage: npx tsx scripts/billing-reconciliation.ts [--period=YYYY-MM]
 */
import "dotenv/config";
import { Prisma, PrismaClient, SubscriptionInvoiceStatus, TariffTier } from "@era365/database/generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const Decimal = Prisma.Decimal;

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaPg(pool as unknown as never) });
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function previousMonthAnchorUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

function parsePeriodArg(): string | null {
  const a = process.argv.find((x) => x.startsWith("--period="));
  return a ? a.slice("--period=".length).trim() : null;
}

async function expectedModuleChargeAzn(
  prisma: PrismaClient,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const billableModules = await prisma.organizationModule.findMany({
    where: {
      organizationId,
      activatedAt: { lt: periodStart },
      OR: [
        { cancelledAt: null },
        { pendingDeactivation: true },
        { accessUntil: { gte: periodEnd } },
      ],
    },
    select: { moduleKey: true },
  });
  const active = billableModules.map((m) => m.moduleKey);
  if (active.length === 0) return 0;
  const modules = await prisma.pricingModule.findMany({
    where: { key: { in: active } },
    select: { pricePerMonth: true },
  });
  return modules.reduce((sum, m) => sum + Number(m.pricePerMonth), 0);
}

async function invoicedForPeriod(
  prisma: PrismaClient,
  organizationId: string,
  billingPeriod: string,
): Promise<number> {
  const items = await prisma.billingInvoiceItem.findMany({
    where: {
      organizationId,
      subscriptionInvoice: {
        billingPeriod,
        status: {
          in: [
            SubscriptionInvoiceStatus.ISSUED,
            SubscriptionInvoiceStatus.PAID,
            SubscriptionInvoiceStatus.OVERDUE,
          ],
        },
      },
    },
    select: { amount: true },
  });
  let s = new Decimal(0);
  for (const it of items) s = s.add(it.amount);
  return Number(s.toFixed(2));
}

async function main() {
  const prisma = createClient();
  const now = new Date();
  const periodStr = parsePeriodArg();
  const anchor = periodStr
    ? new Date(`${periodStr}-01T12:00:00.000Z`)
    : previousMonthAnchorUtc(now);
  const periodStart = startOfMonthUtc(anchor);
  const periodEnd = endOfMonthUtc(anchor);
  const billingPeriod = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}`;

  console.log(`[cp-billing-reconcile] period=${billingPeriod}`);

  const orgs = await prisma.organization.findMany({
    where: {
      subscription: {
        is: {
          currentTier: { not: TariffTier.TIER_3 },
          isTrial: false,
        },
      },
    },
    include: { subscription: true },
  });

  let issues = 0;
  for (const o of orgs) {
    const expected = await expectedModuleChargeAzn(prisma, o.id, periodStart, periodEnd);
    const invoiced = await invoicedForPeriod(prisma, o.id, billingPeriod);
    const diff = Math.abs(expected - invoiced);
    if (expected <= 0) continue;
    if (diff > 0.02) {
      issues++;
      const tag = invoiced < 0.01 ? "FREERIDER_OR_MISSING_INVOICE" : "AMOUNT_MISMATCH";
      console.warn(`[${tag}] org=${o.id} name=${o.name} expected=${expected.toFixed(2)} invoiced=${invoiced.toFixed(2)}`);
    }
  }

  if (issues === 0) {
    console.log(`[cp-billing-reconcile] OK — ${orgs.length} org(s) scanned.`);
  } else {
    console.error(`[cp-billing-reconcile] FAILED — ${issues} drift(s).`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
