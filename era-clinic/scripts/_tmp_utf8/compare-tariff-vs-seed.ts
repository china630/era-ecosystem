/**
 * Compare procedure-types seed (+ catalog) vs Spa Services Tariff xlsx.
 * Also write FO review list for IR/Sollyuks + naftalan collisions.
 *
 *   npx tsx scripts/_tmp_utf8/compare-tariff-vs-seed.ts
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { normalizeCatalogName } from "../../src/lib/import/seed-catalog-match";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const XLSX_PATH = "D:/ERA-BACKUP/NAFTA-START/1c/18-Spa-Services-Tariff.xlsx";

const types = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/procedure-types.json"), "utf8"),
) as Array<{ code: string; name: string; price?: number }>;
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/catalog.json"), "utf8"),
) as Array<{ code: string; nameAz: string; price?: number; sheet?: string }>;
const enNames = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/procedure-en-names.json"), "utf8"),
) as Record<string, string>;

const wb = XLSX.readFile(XLSX_PATH);
const tariff = XLSX.utils.sheet_to_json(wb.Sheets.tariff, { defval: "" }) as Array<{
  n: number;
  code: string;
  match: string;
  Имя: string;
  Цена: number | string;
  "Имя группы": string;
}>;
const removedZero = XLSX.utils.sheet_to_json(wb.Sheets["removed-zero"], { defval: "" }) as Array<{
  Имя: string;
  Цена: number | string;
  "Имя группы": string;
  action: string;
}>;

const typeByCode = new Map(types.map((t) => [t.code, t]));
const catalogByCode = new Map(catalog.map((c) => [c.code, c]));
const typeByNorm = new Map(types.map((t) => [normalizeCatalogName(t.name), t.code]));
const catalogByNorm = new Map(catalog.map((c) => [normalizeCatalogName(c.nameAz), c.code]));

type Row = {
  name: string;
  price: number | string;
  group: string;
  code: string;
  match: string;
};

const paid: Row[] = tariff.map((r) => ({
  name: String(r.Имя || "").trim(),
  price: r.Цена,
  group: String(r["Имя группы"] || "").trim(),
  code: String(r.code || "").trim(),
  match: String(r.match || "").trim(),
}));

const matched = paid.filter((r) => r.code);
const unmatched = paid.filter((r) => !r.code);

const inTypesMatched = matched.filter((r) => typeByCode.has(r.code));
const inCatalogOnlyMatched = matched.filter(
  (r) => !typeByCode.has(r.code) && catalogByCode.has(r.code),
);
const matchedCodeMissingEverywhere = matched.filter(
  (r) => !typeByCode.has(r.code) && !catalogByCode.has(r.code),
);

const typeCodesNotInTariff = types
  .filter((t) => !matched.some((r) => r.code === t.code))
  .map((t) => ({ code: t.code, name: t.name, price: t.price }));

// Unmatched tariff names that fuzzy-hit seed by name
const unmatchedButNameInSeed = unmatched
  .map((r) => {
    const norm = normalizeCatalogName(r.name);
    const typeCode = typeByNorm.get(norm);
    const catCode = catalogByNorm.get(norm);
    return { ...r, typeCode: typeCode ?? null, catCode: catCode ?? null };
  })
  .filter((r) => r.typeCode || r.catCode);

const lines: string[] = [];
lines.push(`# Spa Services Tariff ↔ seed (2026-09-04)`);
lines.push(`Source: \`${XLSX_PATH}\``);
lines.push("");
lines.push(`| Bucket | Count |`);
lines.push(`|---|---:|`);
lines.push(`| Tariff paid rows | ${paid.length} |`);
lines.push(`| With SVC code | ${matched.length} |`);
lines.push(`| Unmatched (no code) | ${unmatched.length} |`);
lines.push(`| Matched + in procedure-types | ${inTypesMatched.length} |`);
lines.push(`| Matched + catalog only (not types) | ${inCatalogOnlyMatched.length} |`);
lines.push(`| Matched code missing from seed | ${matchedCodeMissingEverywhere.length} |`);
lines.push(`| procedure-types not on tariff | ${typeCodesNotInTariff.length} |`);
lines.push(`| Unmatched name but found by name in seed | ${unmatchedButNameInSeed.length} |`);
lines.push(`| removed-zero (package/quota lines) | ${removedZero.length} |`);
lines.push("");

lines.push(`## 1. procedure-types in seed but NOT on paid tariff`);
lines.push("");
if (!typeCodesNotInTariff.length) lines.push("_none_");
else {
  for (const t of typeCodesNotInTariff.sort((a, b) => a.code.localeCompare(b.code))) {
    lines.push(`- \`${t.code}\` — ${t.name} (seed price ${t.price ?? "—"})`);
  }
}
lines.push("");

lines.push(`## 2. Tariff matched codes that are catalog-only (not in procedure-types)`);
lines.push("");
const catOnlyUniq = new Map<string, Row>();
for (const r of inCatalogOnlyMatched) catOnlyUniq.set(r.code, r);
for (const r of [...catOnlyUniq.values()].sort((a, b) => a.code.localeCompare(b.code))) {
  const c = catalogByCode.get(r.code)!;
  lines.push(
    `- \`${r.code}\` — tariff «${r.name}» / catalog «${c.nameAz}» (${c.sheet ?? "?"}, ${c.price})`,
  );
}
lines.push("");

lines.push(`## 3. Tariff UNMATCHED (no code) — top by group`);
lines.push("");
const byGroup = new Map<string, Row[]>();
for (const r of unmatched) {
  const g = r.group || "(no group)";
  (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(r);
}
for (const [g, list] of [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${g} (${list.length})`);
  for (const r of list.sort((a, b) => String(a.name).localeCompare(String(b.name), "az"))) {
    const hint = unmatchedButNameInSeed.find((x) => x.name === r.name);
    const tag = hint
      ? ` → seed ${hint.typeCode ?? hint.catCode}`
      : "";
    lines.push(`- ${r.name} (${r.price})${tag}`);
  }
  lines.push("");
}

lines.push(`## 4. removed-zero highlights (package lines, not SKUs)`);
lines.push("");
const interestingZero = removedZero.filter((r) =>
  /solyuks|sollyuks|naftalan|infra|amplipuls|elektro|parafin|massaj/i.test(String(r.Имя)),
);
for (const r of interestingZero.slice(0, 40)) {
  lines.push(`- ${r.Имя} (${r.Цена}) — ${r.action} / ${r["Имя группы"]}`);
}
lines.push("");

lines.push(`## 5. FO morning — İnfraqırmızı / Sollyuks + naftalan oil`);
lines.push("");
lines.push(
  `Evidence: WO free-text on lamp SKUs almost always says **naft. / naftalanla / bol yağla**. Tariff removed-zero already has **«Solyuks (1 lampa) Naftalanla»** as a package component (price 0). So this is likely **real Nafta practice** (IR/Sollyuks with naftalan smear), not import noise.`,
);
lines.push("");
lines.push(`Ask med block:`);
lines.push(`1. Is İnfraqırmızı routinely prescribed **with naftalan oil** on the skin?`);
lines.push(`2. Same for Sollyuks (especially scalp / baş)?`);
lines.push(`3. If yes: one field on the lamp order (substance=NAFTALAN / extra oil), or a **separate package SKU**?`);
lines.push("");

const infraMd = fs.readFileSync(
  path.join(root, "doc/_tmp_infra-sollyuks-substance-hits.md"),
  "utf8",
);
lines.push(infraMd.replace(/^# .*/m, "### Unique WO texts (from dump)"));

const out = path.join(root, "doc/_tmp_tariff-vs-seed-and-fo-collisions.md");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("wrote", out);
console.log({
  paid: paid.length,
  matched: matched.length,
  unmatched: unmatched.length,
  inTypes: inTypesMatched.length,
  catalogOnly: catOnlyUniq.size,
  typesNotOnTariff: typeCodesNotInTariff.length,
  nameHits: unmatchedButNameInSeed.length,
});
console.log(
  "types not on tariff:",
  typeCodesNotInTariff.map((t) => t.code).join(", ") || "(none)",
);
