/**
 * One-shot: IR Vəzifələr + kadrlar-suallar answers → position regime/hours,
 * dual-stavka sibling positions, unit managers, NAFTA shift catalog / SIX_ONE cycles.
 *
 * Dry-run SQL (default):
 *   node era-orchestrator/scripts/ops/apply-nafta-cadre-rules-from-excel.mjs
 *
 * Does not connect to DB — apply with psql / docker exec.
 * Does not hire people or set vacation balances (Finance SoR).
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const irPath =
  arg("--xlsx") ||
  path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    "İR proqram məlumatları.xlsx",
  );
const outPath =
  arg("--out") || path.resolve("tmp-wf-nafta-cadre-rules.sql");

const NAFTA_ORG = "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";
const BAS_HEKIM_EMP = "30254da5-5285-423c-9972-ef279ac93845";

/** Unit → leadership employment for manager link (Ümumi → Direktor, not deputy). */
const UNIT_MANAGERS = [
  ["Maliyyə", "e2b61646-e4e9-4d8e-ba63-2322f9c5024b"],
  ["Mətbəx", "ba1ce6d1-40d7-43b2-ab14-174b52c52166"],
  ["Qəbul və qeydiyyat", "6059618d-a338-4342-8b25-068f9662bb9d"],
  ["Satınalma və Təchizat", "820d06f2-8fac-485b-96d5-ad1ec1061fe1"],
  ["Satış və Marketinq", "7ead5d32-8376-4d46-95e3-e543c0c49796"],
  ["SƏTƏM", "2c85f274-aa5a-4426-800e-3c5b9e6d600c"],
  ["Texniki", "b15a07cf-b7d1-4355-98d4-fbd3a6e816b0"],
  ["Tibb", "30254da5-5285-423c-9972-ef279ac93845"],
  ["Təhlükəsizlik", "a4791522-29a1-4f76-a3d4-a4ca7f5abfc1"],
  ["Təmizlik", "a77f0323-b895-4360-9bcd-4dd2081c3ad2"],
  ["Ümumi idarəetmə", "f065a201-2205-4599-ab5a-d0cedadc8074"],
  ["İaşə", "c629c7e3-c97a-43cf-8599-6f044e000945"],
  ["İnsan Resursları", "ed7d4b63-ef07-4bf9-bc41-034a1a0d7e3a"],
  ["Əyləncə", "ee22a681-2375-4912-9b4a-4ad5a367a480"],
  /** Q&A: SPA has no leadership seat — curator is Baş həkim. */
  ["İdman və SPA", BAS_HEKIM_EMP],
];

if (!fs.existsSync(irPath)) {
  console.error("Excel not found:", irPath);
  process.exit(1);
}

const wb = XLSX.readFile(irPath);
const sheet = wb.Sheets["Vəzifələr"];
if (!sheet) {
  console.error("Sheet Vəzifələr missing");
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function mapRegime(raw) {
  const r = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  if (!r) return null;
  if (r.includes("həkim") || r.includes("hekim")) return "MEDICAL";
  if (r.includes("növbəli") || r.includes("novbeli")) return "CUSTOM";
  if (r.startsWith("beş") || r.startsWith("bes")) return "FIVE_DAY";
  if (r.startsWith("altı") || r.startsWith("alti")) return "SIX_DAY";
  return "CUSTOM";
}

function parsePrimaryHours(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  if (s.includes(",")) {
    const first = s.split(",")[0].trim().replace(",", ".");
    const n = Number(first);
    return Number.isFinite(n) ? n : null;
  }
  if (s === "40.36") return 40;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Q&A product decisions overlay IR defaults. */
const OVERRIDES = new Map([
  ["İaşə||Ofisiant", { regime: "SIX_DAY", hours: 40 }],
  ["Tibb||Kiçik tibb işçisi", { regime: "SIX_DAY", hours: 40 }],
  ["Tibb||Tibb bacısı", { regime: "SIX_DAY", hours: 36 }],
  ["Tibb||Həkim-Ginekoloq", { regime: "FIVE_DAY", hours: 9 }],
  ["Tibb||Şüa diaqnostiksaı üzrə həkim", { regime: "FIVE_DAY", hours: 10 }],
  [
    "Satış və Marketinq||Rəqəmsal Marketinq  üzrə Menecer",
    { regime: "FIVE_DAY", hours: 10 },
  ],
  ["Texniki||Usta", { regime: "CUSTOM", hours: null }],
  ["Texniki||Texnik", { regime: "CUSTOM", hours: 40 }],
  ["Təhlükəsizlik||Nəzarətçi", { regime: "CUSTOM", hours: 40 }],
]);

const SIBLINGS = [
  {
    unit: "İaşə",
    name: "Ofisiant (36 saat)",
    regime: "SIX_DAY",
    hours: 36,
    slots: 1,
  },
  {
    unit: "Tibb",
    name: "Kiçik tibb işçisi (20 saat)",
    regime: "SIX_DAY",
    hours: 20,
    slots: 1,
  },
  {
    unit: "Tibb",
    name: "Tibb bacısı (18 saat)",
    regime: "SIX_DAY",
    hours: 18,
    slots: 1,
  },
];

const updates = [];
for (const r of rows) {
  const unit = String(r["Şöbə"] || "").trim();
  const name = String(r["Vəzifə"] || "").trim();
  if (!unit || !name) continue;
  let regime = mapRegime(r["Rejim (beşgünlük / altıgünlük / növbəli / həkim)"]);
  let hours = parsePrimaryHours(r["Həftəlik saat"]);
  const ov = OVERRIDES.get(`${unit}||${name}`);
  if (ov) {
    regime = ov.regime;
    hours = ov.hours;
  }
  updates.push({ unit, name, regime, hours });
}

const lines = [];
lines.push("-- Nafta cadre rules: position regime/hours, dual stavka, managers, shifts");
lines.push(`-- Source IR: ${irPath.replace(/\\/g, "/")}`);
lines.push(`-- NAFTA org: ${NAFTA_ORG}`);
lines.push("-- Q&A overlays: dual stavka siblings; SPA→Baş həkim; CUSTOM for dual-regime / Usta");
lines.push("BEGIN;");

lines.push("");
lines.push("-- 1) Position default regime + weekly hours (IR + Q&A)");
for (const u of updates) {
  const regSql = u.regime ? `'${u.regime}'` : "NULL";
  const hrsSql = u.hours == null ? "NULL" : String(u.hours);
  lines.push("UPDATE workforce_positions p");
  lines.push(`SET default_work_regime = ${regSql}::"WorkforceWorkRegime",`);
  lines.push(`    weekly_hours = ${hrsSql},`);
  lines.push("    updated_at = NOW()");
  lines.push("FROM org_units u");
  lines.push("JOIN workforce_scopes s ON s.id = u.workforce_scope_id");
  lines.push("WHERE p.org_unit_id = u.id");
  lines.push(`  AND s.anchor_organization_id = '${NAFTA_ORG}'`);
  lines.push("  AND p.status = 'ACTIVE'");
  lines.push(`  AND u.name = '${esc(u.unit)}'`);
  lines.push(`  AND p.name = '${esc(u.name)}';`);
}

lines.push("");
lines.push("-- 2) Dual-stavka sibling positions (hire path picks the slot)");
for (const s of SIBLINGS) {
  const hrs = s.hours == null ? "NULL" : String(s.hours);
  lines.push("INSERT INTO workforce_positions (");
  lines.push(
    "  id, org_unit_id, name, total_slots, leadership, default_work_regime, weekly_hours, status, created_at, updated_at",
  );
  lines.push(")");
  lines.push("SELECT gen_random_uuid(), u.id,");
  lines.push(
    `  '${esc(s.name)}', ${s.slots}, false, '${s.regime}'::"WorkforceWorkRegime", ${hrs}, 'ACTIVE', NOW(), NOW()`,
  );
  lines.push("FROM org_units u");
  lines.push("JOIN workforce_scopes s ON s.id = u.workforce_scope_id");
  lines.push(`WHERE s.anchor_organization_id = '${NAFTA_ORG}'`);
  lines.push(`  AND u.name = '${esc(s.unit)}'`);
  lines.push("  AND NOT EXISTS (");
  lines.push("    SELECT 1 FROM workforce_positions p");
  lines.push(
    `    WHERE p.org_unit_id = u.id AND p.name = '${esc(s.name)}'`,
  );
  lines.push("  );");
}

lines.push("");
lines.push("-- 3) Org-unit managers (leadership holders + SPA→Baş həkim)");
for (const [unit, empId] of UNIT_MANAGERS) {
  lines.push("UPDATE org_units u");
  lines.push(`SET manager_employment_id = '${empId}', updated_at = NOW()`);
  lines.push("FROM workforce_scopes s");
  lines.push("WHERE u.workforce_scope_id = s.id");
  lines.push(`  AND s.anchor_organization_id = '${NAFTA_ORG}'`);
  lines.push(`  AND u.name = '${esc(unit)}';`);
}

lines.push("");
lines.push("-- 4) Shift types missing on NAFTA (windows from IR Növbələr)");
const shiftTypes = [
  {
    code: "L16",
    name: "Evening 16–00",
    start: 960,
    end: 1440,
    brk: 0,
    night: true,
    hours: 8,
  },
  {
    code: "N08",
    name: "Night 00–08",
    start: 0,
    end: 480,
    brk: 0,
    night: true,
    hours: 8,
  },
  {
    code: "M13",
    name: "Mid 13–21",
    start: 780,
    end: 1260,
    brk: 0,
    night: false,
    hours: 8,
  },
  {
    code: "D12",
    name: "Day 08–20",
    start: 480,
    end: 1200,
    brk: 0,
    night: false,
    hours: 11,
  },
  {
    code: "MED9",
    name: "Medical 09–17",
    start: 540,
    end: 1020,
    brk: 0,
    night: false,
    hours: 8,
  },
];
for (const t of shiftTypes) {
  lines.push("INSERT INTO workforce_shift_types (");
  lines.push(
    "  id, organization_id, code, name, start_minute, end_minute, break_minutes, is_night, default_hours, created_at, updated_at",
  );
  lines.push(")");
  lines.push("SELECT gen_random_uuid(),");
  lines.push(
    `  '${NAFTA_ORG}', '${t.code}', '${esc(t.name)}', ${t.start}, ${t.end}, ${t.brk}, ${t.night}, ${t.hours}, NOW(), NOW()`,
  );
  lines.push("WHERE NOT EXISTS (");
  lines.push(
    `  SELECT 1 FROM workforce_shift_types x WHERE x.organization_id = '${NAFTA_ORG}' AND x.code = '${t.code}'`,
  );
  lines.push(");");
}

lines.push("");
lines.push("-- 5) Cycles: SIX_ONE_DAY (E×6 + OFF), SIX_ONE_MED (MED9×6 + OFF)");
function emitCycle(code, name, typeCode) {
  lines.push(`-- cycle ${code}`);
  lines.push("INSERT INTO workforce_shift_cycles (");
  lines.push(
    "  id, organization_id, code, name, cycle_anchor, created_at, updated_at",
  );
  lines.push(")");
  lines.push("SELECT gen_random_uuid(),");
  lines.push(
    `  '${NAFTA_ORG}', '${code}', '${esc(name)}', DATE '2026-01-05', NOW(), NOW()`,
  );
  lines.push("WHERE NOT EXISTS (");
  lines.push(
    `  SELECT 1 FROM workforce_shift_cycles c WHERE c.organization_id = '${NAFTA_ORG}' AND c.code = '${code}'`,
  );
  lines.push(");");
  for (let i = 0; i < 6; i++) {
    lines.push("INSERT INTO workforce_shift_cycle_slots (");
    lines.push(
      "  id, organization_id, cycle_id, slot_index, shift_type_id",
    );
    lines.push(")");
    lines.push("SELECT gen_random_uuid(),");
    lines.push(`  '${NAFTA_ORG}', c.id, ${i}, t.id`);
    lines.push("FROM workforce_shift_cycles c");
    lines.push("JOIN workforce_shift_types t");
    lines.push(
      `  ON t.organization_id = '${NAFTA_ORG}' AND t.code = '${typeCode}'`,
    );
    lines.push(
      `WHERE c.organization_id = '${NAFTA_ORG}' AND c.code = '${code}'`,
    );
    lines.push("  AND NOT EXISTS (");
    lines.push(
      "    SELECT 1 FROM workforce_shift_cycle_slots s WHERE s.cycle_id = c.id AND s.slot_index = " +
        i,
    );
    lines.push("  );");
  }
  lines.push("INSERT INTO workforce_shift_cycle_slots (");
  lines.push("  id, organization_id, cycle_id, slot_index, shift_type_id");
  lines.push(")");
  lines.push("SELECT gen_random_uuid(),");
  lines.push(`  '${NAFTA_ORG}', c.id, 6, NULL`);
  lines.push("FROM workforce_shift_cycles c");
  lines.push(
    `WHERE c.organization_id = '${NAFTA_ORG}' AND c.code = '${code}'`,
  );
  lines.push("  AND NOT EXISTS (");
  lines.push(
    "    SELECT 1 FROM workforce_shift_cycle_slots s WHERE s.cycle_id = c.id AND s.slot_index = 6",
  );
  lines.push("  );");
}

emitCycle("SIX_ONE_DAY", "6/1 day (08–16)", "E");
emitCycle("SIX_ONE_MED", "6/1 medical (09–17)", "MED9");

lines.push("");
lines.push("-- Verify");
lines.push(`SELECT count(*) FILTER (WHERE default_work_regime IS NOT NULL) AS with_regime,`);
lines.push(`       count(*) FILTER (WHERE weekly_hours IS NOT NULL) AS with_hours,`);
lines.push(`       count(*) AS active_positions`);
lines.push("FROM workforce_positions p");
lines.push("JOIN org_units u ON u.id = p.org_unit_id");
lines.push("JOIN workforce_scopes s ON s.id = u.workforce_scope_id");
lines.push(`WHERE s.anchor_organization_id = '${NAFTA_ORG}' AND p.status = 'ACTIVE';`);

lines.push("SELECT u.name, u.manager_employment_id IS NOT NULL AS has_manager");
lines.push("FROM org_units u");
lines.push("JOIN workforce_scopes s ON s.id = u.workforce_scope_id");
lines.push(`WHERE s.anchor_organization_id = '${NAFTA_ORG}'`);
lines.push("ORDER BY u.name;");

lines.push("SELECT code, name FROM workforce_shift_types");
lines.push(`WHERE organization_id = '${NAFTA_ORG}' ORDER BY code;`);

lines.push("SELECT code, name FROM workforce_shift_cycles");
lines.push(`WHERE organization_id = '${NAFTA_ORG}' ORDER BY code;`);

lines.push("SELECT u.name AS unit, p.name AS position, p.weekly_hours");
lines.push("FROM workforce_positions p");
lines.push("JOIN org_units u ON u.id = p.org_unit_id");
lines.push("JOIN workforce_scopes s ON s.id = u.workforce_scope_id");
lines.push(`WHERE s.anchor_organization_id = '${NAFTA_ORG}'`);
lines.push("  AND p.name IN (");
lines.push("    'Ofisiant (36 saat)',");
lines.push("    'Kiçik tibb işçisi (20 saat)',");
lines.push("    'Tibb bacısı (18 saat)'");
lines.push("  );");

lines.push("COMMIT;");

fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log("wrote", outPath);
console.log("position updates:", updates.length);
console.log("siblings:", SIBLINGS.length);
console.log("unit managers:", UNIT_MANAGERS.length);
