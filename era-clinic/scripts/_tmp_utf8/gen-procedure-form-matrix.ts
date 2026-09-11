/**
 * Rebuild era-clinic/doc/procedure-form-matrix.html from seed + inferPhysioTypeGate
 * + FO-locked substance allowlist (preview until wired in domain).
 * Usage: npx tsx scripts/_tmp_utf8/gen-procedure-form-matrix.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { inferPhysioTypeGate } from "../../src/domain/physio/physio-type-gate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const zones = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/base/physio-zones-s.json"), "utf8"),
).zones as Array<{
  code: string;
  titleRu: string;
  laterality: boolean;
  coarse: string[];
}>;
const list = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/base/physio-list-items.json"), "utf8"),
).items as Array<{ listKind: string; code: string; titleRu: string }>;
const procs = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/procedure-types.json"), "utf8"),
) as Array<{ code: string; name: string }>;

/** Seed substances + FO-new (not in seed yet — preview only). */
const substances: Array<{ code: string; titleRu: string }> = [
  ...list.filter((i) => i.listKind === "SUBSTANCE"),
  { code: "BERODUAL", titleRu: "Berodual" },
  { code: "SALINE", titleRu: "NaCl / натрий хлорид" },
];

/**
 * FO-locked procedure → allowed SUBSTANCE codes (2026-09-03).
 * Empty = procedure has no substance field (or none allowed).
 * Multi-select: doctor picks any combination from the list.
 */
const SUBSTANCE_ALLOW: Record<string, string[]> = {
  "SVC-INQALYASIYA": ["HERBAL", "BERODUAL", "SALINE", "EUFILLIN"],
  "SVC-HIDROKOLONOTERAPIYA-BITKI-CAYI-ILE": ["HERBAL"],
  "SVC-4-KAMERALI-HIDROQALVANIZASIYA": ["NICOTINE"],
  "SVC-ELEKTROTERAPIYA": [
    "POTASSIUM_IODIDE",
    "CALCIUM",
    "NOVOCAINE",
    "KARIPAZIM",
    "DIMEXIDE",
    "HYDROCORTISONE",
    "MAGNESIUM",
    "EUFILLIN",
    "OWN_OINTMENT",
  ],
  "SVC-ULTRAFONOFOREZ": ["NAFTALAN"],
  "SVC-ULTRAFONOFOREZ-GEL": ["DIMEXIDE", "HYDROCORTISONE", "OWN_OINTMENT"],
  "SVC-TURUNDA-BURUN": ["NAFTALAN", "HERBAL"],
  "SVC-TURUNDA-QULAQ": ["NAFTALAN", "HERBAL"],
  "SVC-APLIKASIYA-NAFTALAN-QADIN": ["NAFTALAN"],
  "SVC-APLIKASIYA-NAFTALAN-KISI": ["NAFTALAN"],
  "SVC-INFRAQIRMIZI": ["NAFTALAN"],
  "SVC-SOLLYUKS": ["NAFTALAN"],
  "SVC-ISIQ-VANNASI": ["NAFTALAN"],
};

const bodyPartRu: Record<string, string> = {
  HEAD: "Голова",
  NECK: "Шея",
  CHEST: "Грудь",
  BACK: "Спина",
  ABDOMEN: "Живот",
  ARM_LEFT: "Левая рука",
  ARM_RIGHT: "Правая рука",
  LEG_LEFT: "Левая нога",
  LEG_RIGHT: "Правая нога",
  FULL_BODY: "Всё тело",
};
const latRu: Record<string, string> = {
  LEFT: "Слева",
  RIGHT: "Справа",
  BOTH: "Обе стороны",
};

const zoneByCode = new Map(zones.map((z) => [z.code, z]));
const subByCode = new Map(substances.map((s) => [s.code, s]));

function medsFor(procCode: string): { meds: string; medCodes: string[]; hasSub: boolean } {
  const codes = SUBSTANCE_ALLOW[procCode];
  if (!codes || codes.length === 0) {
    return { meds: "—", medCodes: [], hasSub: false };
  }
  const meds = codes
    .map((c) => {
      const s = subByCode.get(c);
      return s ? `${s.titleRu} (${s.code})` : c;
    })
    .join("; ");
  return { meds, medCodes: codes, hasSub: true };
}

type Row = {
  procedure: string;
  procedureCode: string;
  zone: string;
  zoneCode: string;
  bodyParts: string;
  bodyPartCodes: string[];
  meds: string;
  medCodes: string[];
  directions: string;
  directionCodes: string[];
  needsSite: boolean;
  hasSub: boolean;
};

const IMMERSION_CHIP = new Set([
  "ZONE-FULL-BODY",
  "ZONE-TO-WAIST",
  "ZONE-SITZ",
  "ZONE-FOUR-CHAMBER",
]);

/**
 * One rule for the matrix «грубые части» column:
 * If the procedure’s allowlist is ONLY immersion/bath fill chips → do not expand
 * catalog coarse[] (those chips are fill level, not anatomy).
 * If the procedure has any anatomical surface site → expand coarse for every row
 * (incl. FULL-BODY on Amplipuls = general field, not bath).
 */
function isImmersionOnlyAllowlist(codes: string[]): boolean {
  return codes.length > 0 && codes.every((c) => IMMERSION_CHIP.has(c));
}

function bodyPartsForRow(
  z: { code: string; coarse: string[] },
  immersionOnlyProc: boolean,
): { bodyParts: string; bodyPartCodes: string[] } {
  if (immersionOnlyProc) {
    return { bodyParts: "— (чип погружения, не анатомия)", bodyPartCodes: [] };
  }
  return {
    bodyParts: z.coarse.map((c) => `${bodyPartRu[c] || c} (${c})`).join("; "),
    bodyPartCodes: z.coarse,
  };
}

const rows: Row[] = [];
for (const p of procs) {
  const gate = inferPhysioTypeGate(p.code, p.name);
  const { meds, medCodes, hasSub } = medsFor(p.code);
  const hasLat = gate.fields.includes("LATERALITY");

  if (!gate.needsSite) {
    rows.push({
      procedure: p.name,
      procedureCode: p.code,
      zone: "— (зоны не нужны)",
      zoneCode: "",
      bodyParts: "—",
      bodyPartCodes: [],
      meds,
      medCodes,
      directions: "—",
      directionCodes: [],
      needsSite: false,
      hasSub,
    });
    continue;
  }

  const allowed = gate.allowedSiteCodes.length
    ? gate.allowedSiteCodes
    : zones.map((z) => z.code);
  const immersionOnly = isImmersionOnlyAllowlist(allowed);

  for (const code of allowed) {
    const z = zoneByCode.get(code);
    if (!z) continue;
    const bp = bodyPartsForRow(z, immersionOnly);
    const directionCodes =
      hasLat && z.laterality ? (["LEFT", "RIGHT", "BOTH"] as string[]) : [];
    rows.push({
      procedure: p.name,
      procedureCode: p.code,
      zone: z.titleRu,
      zoneCode: z.code,
      bodyParts: bp.bodyParts,
      bodyPartCodes: bp.bodyPartCodes,
      meds,
      medCodes,
      directions: directionCodes.length
        ? directionCodes.map((d) => `${latRu[d]} (${d})`).join("; ")
        : "—",
      directionCodes,
      needsSite: true,
      hasSub,
    });
  }
}

const procOpts = [...new Set(procs.map((p) => p.name))].sort((a, b) =>
  a.localeCompare(b, "az", { sensitivity: "base" }),
);

rows.sort((a, b) => {
  const byName = a.procedure.localeCompare(b.procedure, "az", { sensitivity: "base" });
  if (byName !== 0) return byName;
  return a.zoneCode.localeCompare(b.zoneCode, "en");
});
const zoneOpts = zones.map((z) => ({ code: z.code, label: z.titleRu }));
const bpOpts = Object.entries(bodyPartRu).map(([code, label]) => ({ code, label }));
/** Filter dropdown: only substances that appear on at least one FO allowlist. */
const usedMedCodes = new Set(Object.values(SUBSTANCE_ALLOW).flat());
const medOpts = substances
  .filter((s) => usedMedCodes.has(s.code))
  .map((s) => ({ code: s.code, label: s.titleRu }));

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Форма назначения процедур — матрица связей</title>
<style>
:root {
  --bg:#f6f5f2; --card:#fff; --text:#1a1a1a; --muted:#5c5c5c; --border:#ddd8ce;
  --accent:#1f4b3a; --accent-soft:#e7f0eb; --chip:#efeae2; --warn:#fff4e5; --bp:#e8eef7;
}
* { box-sizing:border-box; }
html, body { height:100%; margin:0; }
body {
  font:14px/1.45 system-ui,Segoe UI,sans-serif; background:var(--bg); color:var(--text);
  display:flex; flex-direction:column; overflow:hidden;
}
header {
  flex:0 0 auto; background:var(--card); border-bottom:1px solid var(--border);
  padding:14px 18px 12px; z-index:20;
}
h1 { margin:0 0 4px; font-size:18px; font-weight:650; }
.sub { color:var(--muted); font-size:12px; margin-bottom:12px; max-width:1100px; }
.nav { margin-bottom:8px; font-size:12px; }
.nav a { color:var(--accent); margin-right:12px; }
.filters { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:8px; }
label { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.03em; }
select, input[type=search] { width:100%; padding:7px 9px; border:1px solid var(--border); border-radius:6px; background:#fff; color:var(--text); font:inherit; }
.toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:10px; }
.stat { background:var(--accent-soft); color:var(--accent); padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; }
button { border:1px solid var(--border); background:#fff; border-radius:6px; padding:7px 12px; cursor:pointer; font:inherit; }
button:hover { background:var(--chip); }
main { flex:1 1 auto; overflow:auto; padding:0 18px 40px; }
table { width:100%; border-collapse:separate; border-spacing:0; background:var(--card); border:1px solid var(--border); min-width:1100px; }
th, td { padding:8px 10px; border-bottom:1px solid var(--border); vertical-align:top; text-align:left; }
th {
  position:sticky; top:0; z-index:10; background:#f0ebe3;
  font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted);
  box-shadow:0 1px 0 var(--border);
}
tr:hover td { background:#faf8f4; }
.code { color:var(--muted); font-size:11px; font-family:ui-monospace,Consolas,monospace; }
.chip { display:inline-block; background:var(--chip); border-radius:4px; padding:1px 6px; margin:1px 2px 1px 0; font-size:12px; }
.chip.lat { background:var(--accent-soft); color:var(--accent); }
.chip.med { background:var(--warn); }
.chip.bp { background:var(--bp); }
.empty { color:#aaa; }
.note { margin-top:10px; font-size:12px; color:var(--muted); max-width:900px; }
</style>
</head>
<body>
<header>
  <div class="nav">
    <a href="procedure-order-fields-matrix.html">Слой 2: поля заказа →</a>
  </div>
  <h1>Слой 1 — процедура → зоны / препараты</h1>
  <div class="sub">Колонки: Процедура → Зона → Грубые части тела → Препараты → Направления.
  Зоны = <strong>allowedSiteCodes</strong>.
  Правило «грубые части»: если allowlist процедуры <em>только</em> чипы погружения
  (FULL / TO-WAIST / SITZ / 4-камера) → колонка «—» (не разворачиваем coarse каталога).
  Если есть хоть одна анатомическая зона (Amplipuls, массаж, …) → coarse[] как в каталоге.
  Препараты = FO allowlist (preview). Струи Hidromasaj = hint, не S.</div>
  <div class="filters">
    <label>Поиск<input type="search" id="q" placeholder="процедура, зона, препарат…"/></label>
    <label>Процедура<select id="fProc"><option value="">Все</option></select></label>
    <label>Зона<select id="fZone"><option value="">Все</option></select></label>
    <label>Грубая часть тела<select id="fBp"><option value="">Все</option></select></label>
    <label>Препарат<select id="fMed"><option value="">Все</option><option value="__none">Без препаратов</option><option value="__any">С препаратами</option></select></label>
    <label>Направление<select id="fDir"><option value="">Все</option><option value="__none">Без L/R/BOTH</option><option value="LEFT">LEFT</option><option value="RIGHT">RIGHT</option><option value="BOTH">BOTH</option></select></label>
  </div>
  <div class="toolbar">
    <span class="stat" id="count"></span>
    <button type="button" id="reset">Сбросить фильтры</button>
  </div>
</header>
<main>
<table>
<thead>
<tr>
  <th>Процедура</th>
  <th>Зона</th>
  <th>Грубые части тела</th>
  <th>Препараты</th>
  <th>Направления</th>
</tr>
</thead>
<tbody id="tbody"></tbody>
</table>
<p class="note">Одно правило на все ванны/погружение (Hidromasaj, yod-brom, naftalan, 4-камера, bükmə/parafin-FULL):
  coarse не показываем. Amplipuls и surface — показываем. Препараты — FO preview.</p>
</main>
<script>
const ROWS = ${JSON.stringify(rows)};
const PROC_OPTS = ${JSON.stringify(procOpts)};
const ZONE_OPTS = ${JSON.stringify(zoneOpts)};
const BP_OPTS = ${JSON.stringify(bpOpts)};
const MED_OPTS = ${JSON.stringify(medOpts)};

const procSel = document.getElementById("fProc");
const zoneSel = document.getElementById("fZone");
const bpSel = document.getElementById("fBp");
const medSel = document.getElementById("fMed");
const dirSel = document.getElementById("fDir");
const qEl = document.getElementById("q");
const tbody = document.getElementById("tbody");
const countEl = document.getElementById("count");

PROC_OPTS.forEach((n) => {
  const o = document.createElement("option");
  o.value = n;
  o.textContent = n;
  procSel.appendChild(o);
});
ZONE_OPTS.forEach((z) => {
  const o = document.createElement("option");
  o.value = z.code;
  o.textContent = z.label;
  zoneSel.appendChild(o);
});
BP_OPTS.forEach((b) => {
  const o = document.createElement("option");
  o.value = b.code;
  o.textContent = b.label;
  bpSel.appendChild(o);
});
MED_OPTS.forEach((m) => {
  const o = document.createElement("option");
  o.value = m.code;
  o.textContent = m.label;
  medSel.appendChild(o);
});

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chips(text, cls) {
  if (!text || text === "—" || text.startsWith("—")) {
    return '<span class="empty">' + esc(text || "—") + "</span>";
  }
  return text
    .split("; ")
    .map((t) => '<span class="chip ' + cls + '">' + esc(t) + "</span>")
    .join(" ");
}

function render() {
  const q = (qEl.value || "").trim().toLowerCase();
  const fp = procSel.value;
  const fz = zoneSel.value;
  const fb = bpSel.value;
  const fm = medSel.value;
  const fd = dirSel.value;
  const filtered = ROWS.filter((r) => {
    if (fp && r.procedure !== fp) return false;
    if (fz && r.zoneCode !== fz) return false;
    if (fb && !(r.bodyPartCodes || []).includes(fb)) return false;
    if (fm === "__none" && r.hasSub) return false;
    if (fm === "__any" && !r.hasSub) return false;
    if (fm && fm !== "__none" && fm !== "__any" && !(r.medCodes || []).includes(fm)) return false;
    if (fd === "__none" && (r.directionCodes || []).length) return false;
    if (fd && fd !== "__none" && !(r.directionCodes || []).includes(fd)) return false;
    if (q) {
      const hay = [r.procedure, r.procedureCode, r.zone, r.zoneCode, r.bodyParts, r.meds, r.directions]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  countEl.textContent = filtered.length + " / " + ROWS.length + " строк";
  tbody.innerHTML = filtered
    .map(
      (r) =>
        "<tr>" +
        "<td><div><strong>" +
        esc(r.procedure) +
        '</strong></div><div class="code">' +
        esc(r.procedureCode) +
        "</div></td>" +
        "<td><div>" +
        esc(r.zone) +
        "</div>" +
        (r.zoneCode ? '<div class="code">' + esc(r.zoneCode) + "</div>" : "") +
        "</td>" +
        "<td>" +
        chips(r.bodyParts, "bp") +
        "</td>" +
        "<td>" +
        chips(r.meds, "med") +
        "</td>" +
        "<td>" +
        chips(r.directions, "lat") +
        "</td>" +
        "</tr>",
    )
    .join("");
}

["input", "change"].forEach((ev) => {
  qEl.addEventListener(ev, render);
  procSel.addEventListener(ev, render);
  zoneSel.addEventListener(ev, render);
  bpSel.addEventListener(ev, render);
  medSel.addEventListener(ev, render);
  dirSel.addEventListener(ev, render);
});
document.getElementById("reset").onclick = () => {
  qEl.value = "";
  procSel.value = "";
  zoneSel.value = "";
  bpSel.value = "";
  medSel.value = "";
  dirSel.value = "";
  render();
};
render();
</script>
</body>
</html>
`;

const outPath = path.join(root, "doc/procedure-form-matrix.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath, "rows", rows.length);

const withMed = rows.filter((r) => r.hasSub);
console.log(
  "with substances",
  [...new Set(withMed.map((r) => r.procedureCode))].join(", "),
);
for (const code of Object.keys(SUBSTANCE_ALLOW)) {
  const sample = rows.find((r) => r.procedureCode === code);
  console.log(code, "→", sample?.medCodes.join("+") || "(no row)");
}
