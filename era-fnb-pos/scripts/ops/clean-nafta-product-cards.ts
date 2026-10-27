/**
 * Clean Elektraweb product-card export for Nafta F&B:
 * - drop laundry / spa / souvenirs
 * - uppercase category names (az)
 * - correct mis-tagged revenue groups
 * - add numeric hotel Revenue Code (41xx)
 * - fill Product Code from Id when empty
 *
 *   npx tsx scripts/ops/clean-nafta-product-cards.ts --in <xlsx> [--out <xlsx>]
 */
import { mkdirSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import {
  REVENUE_CODE,
  correctedRevenueGroup,
  normalizeCategoryName,
  type MenuCardRow,
} from "../../src/lib/menu-card-import";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function main() {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const input = resolve(arg("--in"));
  if (!arg("--in")) {
    console.error("Usage: npx tsx scripts/ops/clean-nafta-product-cards.ts --in <xlsx> [--out <xlsx>]");
    process.exit(1);
  }
  const output = resolve(
    arg("--out", join(dirname(input), "Product Cards.Nafta-FNB.cleaned.xlsx")),
  );

  const book = XLSX.read(readFileSync(input));
  const sheet = book.Sheets[book.SheetNames[0]!];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const kept: Record<string, unknown>[] = [];
  const skipped: Record<string, unknown>[] = [];
  const categoryMap = new Map<
    string,
    {
      "Product Group Name": string;
      "Revenue Group": string;
      "Revenue Code": string;
      Dishes: number;
    }
  >();

  for (const row of raw) {
    const id = row.Id != null && row.Id !== "" ? String(row.Id) : "";
    const name = String(row["Product Name"] ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!name) {
      skipped.push({ reason: "empty-name", name: "", group: "", revenue: "" });
      continue;
    }
    const productCode =
      String(row["Product Code"] ?? "").trim() || (id ? `ERA-FNB-${id}` : "");
    const productGroup = String(row["Product Group Name"] ?? "");
    const revenueGroup = String(row["Revenue Group"] ?? "");
    const price = Number(row.Price ?? 0);
    const card: MenuCardRow = {
      productCode,
      productGroup,
      name,
      price: Number.isFinite(price) ? price : 0,
      revenueGroup,
    };
    const revenue = correctedRevenueGroup(card);
    if (!revenue) {
      skipped.push({
        reason: "not-fnb",
        id,
        name,
        group: productGroup.trim(),
        revenue: revenueGroup.trim(),
        price: card.price,
      });
      continue;
    }
    const category =
      revenue === "ICARE"
        ? "ZAL İCARƏSİ"
        : normalizeCategoryName(productGroup, revenue);
    const revenueCode = REVENUE_CODE[revenue] ?? "4101";
    const key = `${category}||${revenueCode}`;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        "Product Group Name": category,
        "Revenue Group": revenue,
        "Revenue Code": revenueCode,
        Dishes: 0,
      });
    }
    categoryMap.get(key)!.Dishes += 1;

    kept.push({
      Id: id ? Number(id) || id : "",
      "Product Code": productCode,
      "Product Group Name": category,
      "Product Name": name,
      Price: card.price,
      Currency: String(row.Currency || "AZN").trim() || "AZN",
      "Revenue Group": revenue,
      "Revenue Code": revenueCode,
      "Kitchen Printer No": row["Kitchen Printer No"] ?? "",
      "Valid For Comp": row["Valid For Comp"] ?? "",
      "Discount Active": row["Discount Active"] ?? "true",
      Vat: row.Vat ?? 18,
    });
  }

  const azCmp = (left: string, right: string) =>
    left.localeCompare(right, "az", { sensitivity: "base", numeric: true });
  kept.sort((a, b) => {
    const g = azCmp(String(a["Product Group Name"]), String(b["Product Group Name"]));
    if (g !== 0) return g;
    return azCmp(String(a["Product Name"]), String(b["Product Name"]));
  });

  const categories = [...categoryMap.values()].sort((a, b) =>
    azCmp(a["Product Group Name"], b["Product Group Name"]) ||
    azCmp(a["Revenue Code"], b["Revenue Code"]),
  );

  const outBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outBook, XLSX.utils.json_to_sheet(kept), "Menu");
  XLSX.utils.book_append_sheet(outBook, XLSX.utils.json_to_sheet(categories), "Categories");
  XLSX.utils.book_append_sheet(outBook, XLSX.utils.json_to_sheet(skipped), "Skipped");

  mkdirSync(dirname(output), { recursive: true });
  XLSX.writeFile(outBook, output);

  const repoCopy = resolve(__dirname, "data/nafta-product-cards-cleaned.xlsx");
  mkdirSync(dirname(repoCopy), { recursive: true });
  XLSX.writeFile(outBook, repoCopy);

  const byRevenue = categories.reduce<Record<string, number>>((acc, row) => {
    acc[row["Revenue Code"]] = (acc[row["Revenue Code"]] || 0) + row.Dishes;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        input,
        output,
        repoCopy,
        kept: kept.length,
        skipped: skipped.length,
        categories: categories.length,
        byRevenue,
        categoryList: categories,
      },
      null,
      2,
    ),
  );
}

main();
