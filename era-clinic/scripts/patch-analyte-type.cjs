const fs = require("fs");
const p = "era-clinic/src/domain/catalog/diagnostic-catalog-shared.ts";
let s = fs.readFileSync(p, "utf8");
const re = /export type CatalogAnalyteDef = \{[\s\S]*?\};/;
const repl = `export type CatalogAnalyteValueOption = {
  code: string;
  label: L10n;
};

export type CatalogAnalyteDef = {
  code: string;
  unit?: string;
  label: L10n;
  refMin?: string;
  refMax?: string;
  section?: string;
  valueType?: "NUMERIC" | "QUALITATIVE";
  valueOptions?: CatalogAnalyteValueOption[];
};`;
if (!re.test(s)) {
  console.error("no match");
  process.exit(1);
}
fs.writeFileSync(p, s.replace(re, repl), "utf8");
console.log("ok");
