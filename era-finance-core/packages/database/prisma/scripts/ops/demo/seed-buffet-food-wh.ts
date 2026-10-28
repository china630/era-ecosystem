/**
 * Phase D — Finance FOOD / Non-FOOD warehouses + usage for buffet lab demo.
 * Mirror: seed-tivi.ts (refuse production). Idempotent upsert.
 *
 *   npm run db:seed:buffet-demo
 *
 * Org (first wins): ERA_BUFFET_DEMO_ORGANIZATION_ID → ERA_FB_ORGANIZATION_ID →
 * ERA_LAB_DEMO_ORGANIZATION_ID → orch ERA ID 100000.
 * Outlet code: SEED_BUFFET_OUTLET_CODE or NAFTANI (must match F&B D1 printout).
 * Skip stocktake: SEED_BUFFET_ISSUES_ONLY=1
 * Force refresh: SEED_BUFFET_FORCE=1
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  InventoryAuditStatus,
  Prisma,
  StockMovementReason,
  StockMovementType,
} from "@prisma/client";
import { createPrismaClient, closePrismaPool } from "../../../prisma-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Prefer monorepo root .env, then era-finance-core/.env (same pattern as other ops seeds).
loadEnv({ path: path.resolve(__dirname, "../../../../../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../../../../../../.env") });

if (process.env.NODE_ENV === "production") {
  console.error("[seed-buffet-food-wh] Refuse: NODE_ENV=production");
  process.exit(1);
}

const prisma = createPrismaClient();
const FORCE = process.env.SEED_BUFFET_FORCE === "1";
const ISSUES_ONLY = process.env.SEED_BUFFET_ISSUES_ONLY === "1";
const MARKER = "buffetFoodWhSeed";
const LAB_PUBLIC_ORG_NUMBER = 100_000;

const SENTINELS = new Set([
  "demo-org",
  "nafta-sanatorium-org",
  "nafta-org",
]);

const FOOD_SKUS: Array<{
  sku: string;
  name: string;
  unitPrice: number;
  qtyOut: number;
}> = [
  { sku: "MEAT", name: "Meat (buffet)", unitPrice: 18, qtyOut: 25 },
  { sku: "OIL", name: "Oil (buffet)", unitPrice: 8, qtyOut: 6 },
  { sku: "FLOUR", name: "Flour (buffet)", unitPrice: 1.5, qtyOut: 40 },
  { sku: "PASTA", name: "Pasta (buffet)", unitPrice: 3.2, qtyOut: 20 },
];

function assertRealOrgId(id: string, source: string): string {
  if (!id || SENTINELS.has(id)) {
    throw new Error(`${source} must be a real org UUID (not demo-org / nafta sentinel)`);
  }
  return id;
}

/** Asia/Baku civil YYYY-MM-DD (same rule as satellite-kit todayBakuYmd). */
function todayBakuYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekMondayYmd(anchorYmd: string): string {
  const [y, m, d] = anchorYmd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  utc.setUTCDate(utc.getUTCDate() + mondayOffset);
  return utc.toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

async function resolveOrganizationId(): Promise<string> {
  for (const key of [
    "ERA_BUFFET_DEMO_ORGANIZATION_ID",
    "ERA_FB_ORGANIZATION_ID",
    "ERA_LAB_DEMO_ORGANIZATION_ID",
  ] as const) {
    const envId = process.env[key]?.trim();
    if (!envId) continue;
    return assertRealOrgId(envId, key);
  }
  const orch = (
    process.env.ORCH_API_URL ||
    process.env.NEXT_PUBLIC_ORCH_API_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
  const token =
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    "";
  if (!token) {
    throw new Error(
      "Set ERA_BUFFET_DEMO_ORGANIZATION_ID / ERA_FB_ORGANIZATION_ID / ERA_LAB_DEMO_ORGANIZATION_ID or CONTROL_PLANE_SERVICE_TOKEN",
    );
  }
  const res = await fetch(
    `${orch}/internal/v1/organizations/by-public-number/${LAB_PUBLIC_ORG_NUMBER}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `Lab org ERA ID ${LAB_PUBLIC_ORG_NUMBER} not found (${res.status}).`,
    );
  }
  const data = (await res.json()) as { organizationId?: string };
  return assertRealOrgId(data.organizationId?.trim() ?? "", "orch lab org");
}

async function ensureWarehouse(args: {
  organizationId: string;
  name: string;
  costClass: string;
  satelliteOutletCode: string;
}): Promise<{ id: string }> {
  const existing = await prisma.warehouse.findFirst({
    where: {
      organizationId: args.organizationId,
      deletedAt: null,
      name: args.name,
    },
  });
  if (existing) {
    return prisma.warehouse.update({
      where: { id: existing.id },
      data: {
        costClass: args.costClass,
        satelliteOutletCode: args.satelliteOutletCode,
        location: MARKER,
      },
      select: { id: true },
    });
  }
  return prisma.warehouse.create({
    data: {
      organizationId: args.organizationId,
      name: args.name,
      location: MARKER,
      costClass: args.costClass,
      satelliteOutletCode: args.satelliteOutletCode,
      inventoryAccountCode: "201",
    },
    select: { id: true },
  });
}

async function ensureProduct(
  organizationId: string,
  sku: string,
  name: string,
  price: number,
): Promise<{ id: string }> {
  const existing = await prisma.product.findFirst({
    where: { organizationId, sku, deletedAt: null },
  });
  if (existing) {
    if (FORCE) {
      return prisma.product.update({
        where: { id: existing.id },
        data: { name, price },
        select: { id: true },
      });
    }
    return { id: existing.id };
  }
  return prisma.product.create({
    data: {
      organizationId,
      sku,
      name,
      price,
      vatRate: 18,
      isService: false,
    },
    select: { id: true },
  });
}

async function main(): Promise<void> {
  const organizationId = await resolveOrganizationId();
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org) {
    throw new Error(
      `Finance organization ${organizationId} not found. Provision the lab org in Finance first.`,
    );
  }

  const outletCode = (
    process.env.SEED_BUFFET_OUTLET_CODE?.trim() || "NAFTANI"
  ).toUpperCase();
  const monday = weekMondayYmd(
    process.env.SEED_BUFFET_WEEK_START?.trim() || todayBakuYmd(),
  );
  const midYmd = addDaysYmd(monday, 2);
  const documentDate = new Date(`${midYmd}T00:00:00.000Z`);

  const foodWh = await ensureWarehouse({
    organizationId,
    name: `Buffet FOOD (${outletCode})`,
    costClass: "FOOD",
    satelliteOutletCode: outletCode,
  });
  const chemWh = await ensureWarehouse({
    organizationId,
    name: `Buffet CHEMICAL (${outletCode})`,
    costClass: "CHEMICAL",
    satelliteOutletCode: outletCode,
  });
  const tableWh = await ensureWarehouse({
    organizationId,
    name: `Buffet TABLEWARE (${outletCode})`,
    costClass: "TABLEWARE",
    satelliteOutletCode: outletCode,
  });
  const consumWh = await ensureWarehouse({
    organizationId,
    name: `Buffet CONSUMABLE (${outletCode})`,
    costClass: "CONSUMABLE",
    satelliteOutletCode: outletCode,
  });

  const prevSettings =
    org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
      ? ({ ...(org.settings as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const prevBudget =
    prevSettings.outletBudget &&
    typeof prevSettings.outletBudget === "object" &&
    !Array.isArray(prevSettings.outletBudget)
      ? ({ ...(prevSettings.outletBudget as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  const prevPlans =
    prevBudget.plans && typeof prevBudget.plans === "object" && !Array.isArray(prevBudget.plans)
      ? ({ ...(prevBudget.plans as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  prevPlans[outletCode] = {
    CHEMICAL: 120,
    CONSUMABLE: 80,
    TABLEWARE: 200,
    INVENTORY_GT: 50,
  };
  prevSettings.outletBudget = {
    ...prevBudget,
    planPeriodDays: 7,
    plans: prevPlans,
  };
  prevSettings[MARKER] = {
    at: new Date().toISOString(),
    outletCode,
    weekMonday: monday,
  };
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: prevSettings as Prisma.InputJsonValue },
  });

  for (const row of FOOD_SKUS) {
    const product = await ensureProduct(
      organizationId,
      row.sku,
      row.name,
      row.unitPrice,
    );
    await prisma.stockItem.upsert({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId: foodWh.id,
          productId: product.id,
        },
      },
      create: {
        organizationId,
        warehouseId: foodWh.id,
        productId: product.id,
        quantity: row.qtyOut * 3,
        averageCost: row.unitPrice,
      },
      update: FORCE
        ? { quantity: row.qtyOut * 3, averageCost: row.unitPrice }
        : {},
    });

    const note = `${MARKER}:${row.sku}:${midYmd}`;
    const existingOut = await prisma.stockMovement.findFirst({
      where: {
        organizationId,
        warehouseId: foodWh.id,
        productId: product.id,
        type: StockMovementType.OUT,
        reason: StockMovementReason.SALE,
        note,
      },
    });
    if (!existingOut) {
      await prisma.stockMovement.create({
        data: {
          organizationId,
          warehouseId: foodWh.id,
          productId: product.id,
          type: StockMovementType.OUT,
          reason: StockMovementReason.SALE,
          quantity: row.qtyOut,
          price: row.unitPrice,
          note,
          documentDate,
        },
      });
    } else if (FORCE) {
      await prisma.stockMovement.update({
        where: { id: existingOut.id },
        data: {
          quantity: row.qtyOut,
          price: row.unitPrice,
          documentDate,
        },
      });
    }
  }

  const auditNote = `${MARKER}-stocktake-${monday}`;
  if (ISSUES_ONLY) {
    // Soft-delete prior seed stocktakes so cost-run reliability stays ISSUES_ONLY.
    await prisma.inventoryAudit.updateMany({
      where: {
        organizationId,
        warehouseId: foodWh.id,
        notes: { startsWith: `${MARKER}-stocktake-` },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        deletedReason: "SEED_BUFFET_ISSUES_ONLY",
        status: InventoryAuditStatus.CANCELLED,
      },
    });
  } else {
    const existingAudit = await prisma.inventoryAudit.findFirst({
      where: {
        organizationId,
        warehouseId: foodWh.id,
        notes: auditNote,
        deletedAt: null,
      },
    });
    if (!existingAudit) {
      await prisma.inventoryAudit.create({
        data: {
          organizationId,
          warehouseId: foodWh.id,
          date: new Date(`${monday}T00:00:00.000Z`),
          status: InventoryAuditStatus.COMPLETED,
          notes: auditNote,
          startedAt: documentDate,
          completedAt: new Date(documentDate.getTime() + 3_600_000),
          number: `BUFF-${monday.replace(/-/g, "")}`,
        },
      });
    } else if (FORCE) {
      await prisma.inventoryAudit.update({
        where: { id: existingAudit.id },
        data: {
          status: InventoryAuditStatus.COMPLETED,
          completedAt: new Date(documentDate.getTime() + 3_600_000),
          deletedAt: null,
          deletedReason: null,
        },
      });
    }
  }

  // Non-FOOD OUT so outlet-budget factAzn > 0 (UAT chef path).
  const nonFoodUsage: Array<{
    whId: string;
    sku: string;
    name: string;
    unitPrice: number;
    qtyOut: number;
  }> = [
    { whId: chemWh.id, sku: "CHEM-CLEAN", name: "Kitchen cleaner", unitPrice: 4, qtyOut: 8 },
    { whId: tableWh.id, sku: "TW-PLATE", name: "Buffet plate", unitPrice: 2.5, qtyOut: 12 },
    { whId: consumWh.id, sku: "CONS-NAPKIN", name: "Napkin pack", unitPrice: 1.2, qtyOut: 20 },
  ];
  for (const row of nonFoodUsage) {
    const product = await ensureProduct(
      organizationId,
      row.sku,
      row.name,
      row.unitPrice,
    );
    await prisma.stockItem.upsert({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId: row.whId,
          productId: product.id,
        },
      },
      create: {
        organizationId,
        warehouseId: row.whId,
        productId: product.id,
        quantity: row.qtyOut * 3,
        averageCost: row.unitPrice,
      },
      update: FORCE
        ? { quantity: row.qtyOut * 3, averageCost: row.unitPrice }
        : {},
    });
    const note = `${MARKER}:nonfood:${row.sku}:${midYmd}`;
    const existingOut = await prisma.stockMovement.findFirst({
      where: {
        organizationId,
        warehouseId: row.whId,
        productId: product.id,
        type: StockMovementType.OUT,
        reason: StockMovementReason.SALE,
        note,
      },
    });
    if (!existingOut) {
      await prisma.stockMovement.create({
        data: {
          organizationId,
          warehouseId: row.whId,
          productId: product.id,
          type: StockMovementType.OUT,
          reason: StockMovementReason.SALE,
          quantity: row.qtyOut,
          price: row.unitPrice,
          note,
          documentDate,
        },
      });
    } else if (FORCE) {
      await prisma.stockMovement.update({
        where: { id: existingOut.id },
        data: {
          quantity: row.qtyOut,
          price: row.unitPrice,
          documentDate,
        },
      });
    }
  }

  console.log(
    [
      "[seed-buffet-food-wh] OK",
      `org=${organizationId}`,
      `outletCode=${outletCode}`,
      `foodWh=${foodWh.id}`,
      `weekMonday=${monday}`,
      `usageDay=${midYmd}`,
      ISSUES_ONLY ? "stocktake=skipped(ISSUES_ONLY)" : "stocktake=COMPLETED",
    ].join(" "),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await closePrismaPool();
  });
