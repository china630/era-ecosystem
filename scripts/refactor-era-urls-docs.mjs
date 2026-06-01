#!/usr/bin/env node
/** One-off doc sweep: era.az hosts, old ports, folder names. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const HOST_MAP = [
  ["app.era.az", "app.era-365.online"],
  ["api.era.az", "api.era-365.online"],
  ["finance.era.az", "finance-core.era-365.online"],
  ["finance-api.era.az", "finance-api.era-365.online"],
  ["hotel.era.az", "hotel-pms.era-365.online"],
  ["pos.era.az", "fnb-pos.era-365.online"],
  ["fb.era.az", "fnb-pos.era-365.online"],
  ["retail.era.az", "retail-pos.era-365.online"],
  ["logistics.era.az", "logistics.era-365.online"],
  ["construction.era.az", "construction.era-365.online"],
  ["crm.era.az", "crm.era-365.online"],
  ["auto.era.az", "auto-service.era-365.online"],
  ["wholesale.era.az", "wholesale.era-365.online"],
  ["clinic.era.az", "clinic.era-365.online"],
  ["era-365-orchestrator", "era-orchestrator"],
  ["era-fb-pos", "era-fnb-pos"],
  ["era-auto-sto", "era-auto-service"],
  ["era-crm-field", "era-crm"],
  ["FB_POS_DB", "FNB_POS_DB"],
  ["CRM_FIELD_DB", "CRM_DB"],
  ["AUTO_STO_DB", "AUTO_SERVICE_DB"],
  ["era_fb_pos", "era_fnb_pos"],
  ["era_crm_field", "era_crm"],
  ["era_auto_sto", "era_auto_service"],
  ["NEXT_PUBLIC_SATELLITE_FB_POS_URL", "NEXT_PUBLIC_SATELLITE_FNB_POS_URL"],
  ["FB_POS_WEBHOOK_URL", "FNB_POS_WEBHOOK_URL"],
  ["NEXT_PUBLIC_FB_POS_URL", "NEXT_PUBLIC_FNB_POS_URL"],
  ["industry_fb_pos", "industry_fnb_pos"],
  ["industry_retail_ecom", "industry_retail"],
  ["industry_logistics_customs", "industry_logistics"],
  ["industry_crm_whatsapp", "industry_crm"],
  ["industry_auto_sto", "industry_auto_service"],
];

const PORT_LINES = [
  [/\| Orchestrator Web \| 3100 \|/g, "| Orchestrator Web | 3000 |"],
  [/\| Orchestrator API \| 4100 \|/g, "| Orchestrator API | 4000 |"],
  [/\| Finance API \| 4000 \|/g, "| Finance API | 4100 |"],
  [/\| Finance Web \| 3000 \|/g, "| Finance Web | 3100 |"],
  [/\| Hotel PMS \| 3000 \|/g, "| Hotel PMS | 3201 |"],
  [/\| F&B POS \| 3200 \|/g, "| F&B POS | 3202 |"],
  [/\| `era-hotel-pms`.*\| 3000 \|/g, "| `era-hotel-pms` | [PRD](era-hotel-pms/PRD.md) | hotel-pms.era-365.online | 3201 |"],
];

const EXTS = new Set([".md", ".html", ".yml", ".yaml", ".json", ".mjs", ".ts", ".tsx", ".example", ".env"]);
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "agent-transcripts", ".cursor/plans"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name)) || name === "Dockerfile" || name === "Dockerfile.web")
      out.push(p);
  }
  return out;
}

let files = 0;
for (const file of walk(ROOT)) {
  if (file.includes("refactor-era-urls-docs.mjs")) continue;
  let text = readFileSync(file, "utf8");
  const orig = text;
  for (const [from, to] of HOST_MAP) text = text.split(from).join(to);
  for (const [re, rep] of PORT_LINES) text = text.replace(re, rep);
  // README table ports (specific rows)
  text = text
    .replace(/\| `era-fnb-pos`.*\| 3200 \|/g, "| `era-fnb-pos` | [PRD](era-fnb-pos/PRD.md) | fnb-pos.era-365.online | 3202 |")
    .replace(/\| `era-retail-pos`.*\| 3300 \|/g, "| `era-retail-pos` | [PRD](era-retail-pos/PRD.md) | retail-pos.era-365.online | 3204 |")
    .replace(/\| `era-logistics`.*\| 3301 \|/g, "| `era-logistics` | [PRD](era-logistics/PRD.md) | logistics.era-365.online | 3205 |")
    .replace(/\| `era-construction`.*\| 3302 \|/g, "| `era-construction` | [PRD](era-construction/PRD.md) | construction.era-365.online | 3206 |")
    .replace(/\| `era-crm`.*\| 3303 \|/g, "| `era-crm` | [PRD](era-crm/PRD.md) | crm.era-365.online | 3207 |")
    .replace(/\| `era-auto-service`.*\| 3304 \|/g, "| `era-auto-service` | [PRD](era-auto-service/PRD.md) | auto-service.era-365.online | 3208 |")
    .replace(/\| `era-wholesale`.*\| 3305 \|/g, "| `era-wholesale` | [PRD](era-wholesale/PRD.md) | wholesale.era-365.online | 3209 |")
    .replace(/\| `era-clinic`.*\| 3306 \|/g, "| `era-clinic` | [PRD](era-clinic/PRD.md) | clinic.era-365.online | 3203 |");
  if (text !== orig) {
    writeFileSync(file, text);
    files += 1;
  }
}
console.log(`Updated ${files} files`);
