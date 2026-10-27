/**
 * Split a cleaned Nafta product-card workbook into F&B cutover import files:
 *   30-Product-Groups.xlsx
 *   31-Product-Cards.xlsx
 *
 *   npx tsx scripts/ops/split-nafta-menu-import.ts --in <cleaned.xlsx> [--out-dir <dir>]
 */
import { mkdirSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import {
  planMenuCards,
  type MenuCardRow,
} from "../../src/lib/menu-card-import";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function categoryCodeSlug(name: string): string {
  return name
    .trim()
    .toLocaleUpperCase("az-AZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ə/g, "E")
    .replace(/Ö/g, "O")
    .replace(/Ü/g, "U")
    .replace(/Ğ/g, "G")
    .replace(/Ş/g, "S")
    .replace(/Ç/g, "C")
    .replace(/İ/g, "I")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "MENU";
}

function main() {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const input = resolve(arg("--in"));
  if (!arg("--in")) {
    console.error(
      "Usage: npx tsx scripts/ops/split-nafta-menu-import.ts --in <cleaned.xlsx> [--out-dir <dir>]",
    );
    process.exit(1);
  }
  const outDir = resolve(arg("--out-dir", dirname(input)));
  mkdirSync(outDir, { recursive: true });

  const book = XLSX.read(readFileSync(input));
  const menuSheet =
    book.Sheets.Menu ?? book.Sheets[book.SheetNames[0]!];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(menuSheet, {
    defval: "",
  });

  const rows: MenuCardRow[] = raw.map((row) => ({
    productCode: String(row["Product Code"] ?? "").trim(),
    productGroup: String(row["Product Group Name"] ?? "").trim(),
    name: String(row["Product Name"] ?? "").trim(),
    price: Number(row.Price ?? 0),
    revenueGroup: String(row["Revenue Group"] ?? "").trim(),
  }));

  const plan = planMenuCards(
    rows.map((row, index) => ({
      ...row,
      productCode:
        row.productCode ||
        String(raw[index]?.Id ?? "").trim() ||
        `ERA-FNB-${index + 1}`,
    })),
  );

  const catByCode = new Map(plan.categories.map((c) => [c.code, c]));
  const groups = plan.categories
    .map((cat, index) => ({
      "Group Code": categoryCodeSlug(cat.name),
      "Product Group Name": cat.name,
      "Revenue Code": cat.revenueCode,
      "Display Order": index + 1,
      Active: true,
    }))
    .sort((a, b) =>
      a["Product Group Name"].localeCompare(b["Product Group Name"], "az", {
        sensitivity: "base",
        numeric: true,
      }),
    )
    .map((row, index) => ({ ...row, "Display Order": index + 1 }));

  const groupCodeByName = new Map(
    groups.map((g) => [g["Product Group Name"], g["Group Code"]]),
  );

  const cards = plan.dishes
    .map((dish) => {
      const cat = catByCode.get(dish.categoryCode);
      const groupName = cat?.name ?? "MENU";
      return {
        "Product Code": dish.plu,
        "Product Name": dish.name,
        "Product Group Name": groupName,
        Price: dish.priceAzn,
        Active: true,
        "Finance SKU": dish.financeSku,
        "Recipe SKU": dish.recipeSku ?? "",
        "Revenue Code": cat?.revenueCode ?? "",
      };
    })
    .sort((a, b) => {
      const g = a["Product Group Name"].localeCompare(b["Product Group Name"], "az", {
        sensitivity: "base",
        numeric: true,
      });
      if (g !== 0) return g;
      return a["Product Name"].localeCompare(b["Product Name"], "az", {
        sensitivity: "base",
        numeric: true,
      });
    });

  const groupsPath = join(outDir, "30-Product-Groups.xlsx");
  const cardsPath = join(outDir, "31-Product-Cards.xlsx");

  const groupsBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    groupsBook,
    XLSX.utils.json_to_sheet(groups),
    "Product groups",
  );
  XLSX.writeFile(groupsBook, groupsPath);

  const cardsBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    cardsBook,
    XLSX.utils.json_to_sheet(cards),
    "Product cards",
  );
  XLSX.writeFile(cardsBook, cardsPath);

  console.log(
    JSON.stringify(
      {
        input,
        groupsPath,
        cardsPath,
        groups: groups.length,
        cards: cards.length,
        portionsWithRecipe: cards.filter((c) => c["Recipe SKU"]).length,
        sampleGroup: groups[0],
        sampleCard: cards[0],
        groupCodes: [...groupCodeByName.entries()].slice(0, 5),
      },
      null,
      2,
    ),
  );
}

main();
