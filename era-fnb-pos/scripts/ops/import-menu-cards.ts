/**
 * Import F&B product cards. Revenue group lands on the category.
 * Dishes are stored without a revenue code. Laundry and clinic rows are skipped.
 *
 *   npx tsx scripts/ops/import-menu-cards.ts --org <hotelOrgId> --file <xlsx> [--outlet RESTAURANT]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { planMenuCards, type MenuCardRow } from "../../src/lib/menu-card-import";

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : "";
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readRows(file: string): MenuCardRow[] {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const book = XLSX.read(readFileSync(file));
  const sheet = book.Sheets[book.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => ({
    productCode: String(row["Product Code"] ?? ""),
    productGroup: String(row["Product Group Name"] ?? ""),
    name: String(row["Product Name"] ?? ""),
    price: Number(row["Price"] ?? 0),
    revenueGroup: String(row["Revenue Group"] ?? ""),
  }));
}

async function main() {
  const organizationId = arg("--org");
  const file = arg("--file");
  const outletCode = process.argv.includes("--outlet") ? arg("--outlet") : "RESTAURANT";
  const plan = planMenuCards(readRows(file));
  const prisma = new PrismaClient();
  try {
    const outlet = await prisma.outlet.findFirst({
      where: { organizationId, code: outletCode },
    });
    if (!outlet) throw new Error(`Outlet ${outletCode} was not found`);
    const categoryId = new Map<string, string>();
    for (const category of plan.categories) {
      const saved = await prisma.menuCategory.upsert({
        where: { outletId_code: { outletId: outlet.id, code: category.code } },
        create: {
          organizationId,
          outletId: outlet.id,
          code: category.code,
          name: category.name,
          revenueCode: category.revenueCode,
        },
        update: { name: category.name, revenueCode: category.revenueCode },
      });
      categoryId.set(category.code, saved.id);
    }
    for (const dish of plan.dishes) {
      const category = categoryId.get(dish.categoryCode);
      if (!category) continue;
      await prisma.menuItem.upsert({
        where: { categoryId_plu: { categoryId: category, plu: dish.plu } },
        create: {
          organizationId,
          categoryId: category,
          plu: dish.plu,
          name: dish.name,
          priceAzn: dish.priceAzn,
          financeSku: dish.financeSku,
          recipeSku: dish.recipeSku,
          revenueCode: null,
        },
        update: {
          name: dish.name,
          priceAzn: dish.priceAzn,
          financeSku: dish.financeSku,
          recipeSku: dish.recipeSku,
          revenueCode: null,
        },
      });
    }
    console.log(
      `categories ${plan.categories.length}, dishes ${plan.dishes.length}, skipped ${plan.skipped.length}`,
    );
    const portions = plan.dishes.filter((dish) => dish.recipeSku);
    if (portions.length > 0) {
      console.log("portion recipes (finance pour size still required):");
      for (const dish of portions) console.log(`  ${dish.plu} -> ${dish.recipeSku}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
