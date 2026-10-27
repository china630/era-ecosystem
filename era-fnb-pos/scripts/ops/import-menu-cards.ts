/**
 * Import F&B product cards from a cleaned or #31 workbook.
 * Revenue lands on the category. Dishes keep financeSku / recipeSku; dish revenueCode stays null.
 * Laundry, SPA, and souvenirs are skipped by the planner.
 *
 *   npx tsx scripts/ops/import-menu-cards.ts --org <orgId> --file <xlsx> [--outlet RESTAURANT]
 *
 * Prefer the cutover wizard with #30 then #31. This script is the single-file ops path.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import {
  REVENUE_CODE,
  planMenuCards,
  type MenuCardRow,
} from "../../src/lib/menu-card-import";

const CODE_TO_REVENUE = Object.fromEntries(
  Object.entries(REVENUE_CODE).map(([group, code]) => [code, group]),
) as Record<string, string>;

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
  return rows.map((row) => {
    const revenueCode = String(row["Revenue Code"] ?? "").trim();
    const revenueGroup =
      String(row["Revenue Group"] ?? "").trim() ||
      CODE_TO_REVENUE[revenueCode] ||
      "";
    return {
      productCode: String(row["Product Code"] ?? "").trim(),
      productGroup: String(row["Product Group Name"] ?? "").trim(),
      name: String(row["Product Name"] ?? "").trim(),
      price: Number(row.Price ?? 0),
      revenueGroup,
    };
  });
}

function sheetExtras(file: string): Map<string, { financeSku: string; recipeSku: string | null }> {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const book = XLSX.read(readFileSync(file));
  const sheet = book.Sheets[book.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const map = new Map<string, { financeSku: string; recipeSku: string | null }>();
  for (const row of rows) {
    const plu = String(row["Product Code"] ?? "").trim();
    if (!plu) continue;
    const financeSku = String(row["Finance SKU"] ?? "").trim() || plu;
    const recipeRaw = String(row["Recipe SKU"] ?? "").trim();
    map.set(plu, { financeSku, recipeSku: recipeRaw || null });
  }
  return map;
}

async function main() {
  const organizationId = arg("--org");
  const file = arg("--file");
  const outletCode = process.argv.includes("--outlet") ? arg("--outlet") : "RESTAURANT";
  const plan = planMenuCards(readRows(file));
  const extras = sheetExtras(file);
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
      const extra = extras.get(dish.plu);
      const financeSku = extra?.financeSku || dish.financeSku;
      const recipeSku = extra?.recipeSku ?? dish.recipeSku;
      await prisma.menuItem.upsert({
        where: { categoryId_plu: { categoryId: category, plu: dish.plu } },
        create: {
          organizationId,
          categoryId: category,
          plu: dish.plu,
          name: dish.name,
          priceAzn: dish.priceAzn,
          financeSku,
          recipeSku,
          revenueCode: null,
        },
        update: {
          name: dish.name,
          priceAzn: dish.priceAzn,
          financeSku,
          recipeSku,
          revenueCode: null,
        },
      });
    }
    console.log(
      `categories ${plan.categories.length}, dishes ${plan.dishes.length}, skipped ${plan.skipped.length}`,
    );
    const portions = plan.dishes.filter((dish) => extras.get(dish.plu)?.recipeSku || dish.recipeSku);
    if (portions.length > 0) {
      console.log("portion recipes (finance pour size still required):");
      for (const dish of portions) {
        const recipe = extras.get(dish.plu)?.recipeSku ?? dish.recipeSku;
        console.log(`  ${dish.plu} -> ${recipe}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
