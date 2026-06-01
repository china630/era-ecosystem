#!/usr/bin/env node
/** Point satellite help page footers to orchestrator canonical FAQ. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sats = [
  "era-retail-pos",
  "era-wholesale",
  "era-clinic",
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
  "era-fnb-pos",
];

for (const sat of sats) {
  const file = path.join(root, sat, "app/help/page.tsx");
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("orchPublicHref")) continue;
  if (!src.includes('faqHref="/help"')) continue;
  src = src.replace(
    'from "@era/satellite-kit/ui";',
    'from "@era/satellite-kit/ui";\nimport { orchPublicHref } from "@era/satellite-kit";',
  );
  src = src.replace('faqHref="/help"', 'faqHref={orchPublicHref("/help")}');
  fs.writeFileSync(file, src, "utf8");
  console.log("patched help faq link:", file);
}
