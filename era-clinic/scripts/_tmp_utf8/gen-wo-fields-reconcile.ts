/**
 * Reconcile WO nahiye matcher flags vs inferPhysioTypeGate fields.
 * Reads live cards dump; writes era-clinic/doc/wo-fields-reconcile.html
 *
 *   npx tsx scripts/_tmp_utf8/gen-wo-fields-reconcile.ts
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { PHYSIO_ORDER_FIELD_CODES } from "../../src/domain/physio/physio-order-fields";
import { inferPhysioTypeGate } from "../../src/domain/physio/physio-type-gate";
import { normalizeCatalogName, matchProcedureToSeed } from "../../src/lib/import/seed-catalog-match";

const require = createRequire(import.meta.url);
const { buildMatcher } = require("../nafta-cutover/nahiye-s-match.cjs") as {
  buildMatcher: (cat: unknown) => { match: (text: string, opts?: { procedureName?: string }) => { flags: string[]; chips: string[]; residue: string } };
};
const { loadMergedPhysioZonesCatalog } = require("../../src/domain/physio/physio-catalog-layers.cjs") as {
  loadMergedPhysioZonesCatalog: (root: string) => {
    orderFieldsNotZones: Array<{ code: string; wo?: string[] }>;
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const CARDS = "D:/ERA-BACKUP/NAFTA-START/clinic/dump/cards";

const procs = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/procedure-types.json"), "utf8"),
) as Array<{ code: string; name: string }>;

const EXTRA_MATCHER_FLAGS = [
  "SEQUENCE_ALTERNATING",
  "SEQUENCE_SIMULTANEOUS",
  "APPLICATION_CUT",
  "PROCEDURE_NAME_BLEED",
] as const;

const FIELD_COLS = [...PHYSIO_ORDER_FIELD_CODES, ...EXTRA_MATCHER_FLAGS];

const FIELD_LABEL: Record<string, string> = {
  LATERALITY: "L/R/BOTH",
  AMPLIPULS_WORK_KIND: "Amplipuls I–V",
  DEVICE_PROGRAM: "Программа",
  ELECTRODE_COUNT: "Электроды",
  DEVICE_PARAMS: "Параметры",
  NO_ADDITIVE: "sadə",
  APPLICATION_SURFACE: "Поверхность",
  SUBSTANCE_OR_ADDITIVE: "Препарат",
  EXTRA_OIL: "Масло",
  HOLD_OR_STOP: "Стоп",
  SPINE_LEVEL: "Позв.",
  DAY_BLOCK: "Блок дней",
  BATH_SEQUENCE: "Ванна-дни",
  NAFTALAN_FILL: "Fill",
  INTENSITY: "Интенс.",
  SMEAR: "Smear",
  SEQUENCE_ALTERNATING: "növbəli",
  SEQUENCE_SIMULTANEOUS: "eyni vaxtda",
  APPLICATION_CUT: "носок/перч.",
  PROCEDURE_NAME_BLEED: "bleed имени",
};

/** WO name leftovers not in seed-catalog-match aliases. */
const WO_NAME_ALIASES: Record<string, string> = {
  elektroforez: "SVC-ELEKTROTERAPIYA",
  "massaj 30": "SVC-KLASIK-MASSAJ-30-DEQIQE",
  "massaj 30 test": "SVC-KLASIK-MASSAJ-30-DEQIQE",
  "massaj 15": "SVC-KLASIK-MASSAJ-15-DEQIQE",
  "mig kohne": "SVC-MAQNITOTERAPIYA",
  mig: "SVC-MAQNITOTERAPIYA",
  maqnitoterapiya: "SVC-MAQNITOTERAPIYA",
  "naftalan vannasi qadin": "SVC-NAFTALAN-VANNASI-QADIN",
  "naftalan vannasi kisi": "SVC-NAFTALAN-VANNASI-KISI",
  "tam beden naftalan vannasi": "SVC-NAFTALAN-VANNASI-QADIN",
  "parafin asagi etraf": "SVC-PARAFINOTERAPIYA-ASAGI-ETRAF",
  "parafin asagi nahiye": "SVC-PARAFINOTERAPIYA-ASAGI-ETRAF",
  "parafin yuxari etraf": "SVC-PARAFINOTERAPIYA-YUXARI-ETRAF",
  "parafin yuxari nahiye": "SVC-PARAFINOTERAPIYA-YUXARI-ETRAF",
  "parafin boyun kurek": "SVC-PARAFINOTERAPIYA-BOYUN-KUREK",
  "parafin kurek onurga": "SVC-PARAFINOTERAPIYA-BOYUN-KUREK",
  "parafin butun beden": "SVC-PARAFINOTERAPIYA-BUTUN-BEDEN",
  "super induktiv terapiya": "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
  "super inductive system terapiyasi": "SVC-SUPER-INDUCTIVE-SYSTEM-TERAPIYASI",
  "yod brom vanna": "SVC-YOD-BROM-VANNASI",
  "yod brom vannasi": "SVC-YOD-BROM-VANNASI",
  "trunda burun": "SVC-TURUNDA-BURUN",
  "turunda burun": "SVC-TURUNDA-BURUN",
  "karbon vannasi 15 deq": "SVC-KARBOKSITERAPIYA",
  karboksiterapiya: "SVC-KARBOKSITERAPIYA",
  "hidrokolon bitki cayi ile": "SVC-HIDROKOLONOTERAPIYA-BITKI-CAYI-ILE",
  "zerbe dalga": "SVC-ZERBE-DALGA-TERAPIYA",
  "zerbe dalga terapiya": "SVC-ZERBE-DALGA-TERAPIYA",
  "hidromasaj vanna": "SVC-HIDROMASAJ-VANNASI",
  "hidromasaj vannasi": "SVC-HIDROMASAJ-VANNASI",
  hidrokolon: "SVC-HIDROKOLONOTERAPIYA",
  "turunda qulaq": "SVC-TURUNDA-QULAQ",
  "trunda qulaq": "SVC-TURUNDA-QULAQ",
  "turunda burun ve qulaq": "SVC-TURUNDA-BURUN",
  "aplikasiya naftalan": "SVC-APLIKASIYA-NAFTALAN-QADIN",
  "aplikasiya naftalan qadin": "SVC-APLIKASIYA-NAFTALAN-QADIN",
  "aplikasiya naftalan kisi": "SVC-APLIKASIYA-NAFTALAN-KISI",
  traksiya: "SVC-TRAKSIYA",
  "fitoterapiya bocka": "SVC-FITO-TERAPIYA-BOCKA",
  "fito terapiya bocka": "SVC-FITO-TERAPIYA-BOCKA",
  mikroklizma: "SVC-UROLOJI-MIKROKLIZMA",
  "manual terapiya": "SVC-MANUAL-TERAPIYA",
  "isiq vannasi": "SVC-ISIQ-VANNASI",
  osteopatiya: "SVC-OSTEOPATIYA",
  "ginekoloji tampon": "SVC-GINEKOLOJI-TAMPON",
  "xallarin koaqulyasiyasi": "SVC-XALLARIN-KOAQULYASIYASI",
  proloterapiya: "SVC-PROLOTERAPIYA",
  proloterapiya2: "SVC-PROLOTERAPIYA",
  "4 kamera vanna": "SVC-4-KAMERALI-NAFTALAN-VANNASI",
  "4 kamera hidroqalvanizasiya": "SVC-4-KAMERALI-HIDROQALVANIZASIYA",
  "ultrafonoforez naftalan yagiyla": "SVC-ULTRAFONOFOREZ",
  "ultrafonoforez gelle": "SVC-ULTRAFONOFOREZ-GEL",
  ufb: "SVC-UFB-TERAPIYA",
  "ufb terapiya": "SVC-UFB-TERAPIYA",
  limfodrenaj: "SVC-LIMFODRENAJ",
  darsonval: "SVC-DARSONVAL",
  lazerterapiya: "SVC-LAZERTERAPIYA",
  infraqirmizi: "SVC-INFRAQIRMIZI",
  inqalyasiya: "SVC-INQALYASIYA",
  ozonterapiya: "SVC-OZONTERAPIYA",
  vakuumterapiya: "SVC-VAKUUMTERAPIYA",
  bukme: "SVC-BUKME",
  sollyuks: "SVC-SOLLYUKS",
  solyuks: "SVC-SOLLYUKS",
};

type Agg = {
  code: string;
  name: string;
  woRows: number;
  woFilled: number;
  flagHits: Record<string, number>;
  unmatchedTreatments: Map<string, number>;
};

function resolveProc(treatmentName: string): { code: string; name: string } | null {
  const cleaned = String(treatmentName || "")
    .replace(/[\u0430\u0435\u043E\u0440\u0441\u0445]/g, (ch) => {
      // Cyrillic lookalikes → Latin (WO typos)
      const map: Record<string, string> = {
        "\u0430": "a",
        "\u0435": "e",
        "\u043E": "o",
        "\u0440": "p",
        "\u0441": "c",
        "\u0445": "x",
      };
      return map[ch] || ch;
    });
  const hit = matchProcedureToSeed(cleaned, procs);
  if (hit) return hit;
  const norm = normalizeCatalogName(cleaned);
  const alias = WO_NAME_ALIASES[norm];
  if (alias) {
    const p = procs.find((x) => x.code === alias);
    if (p) return p;
  }
  for (const p of procs) {
    if (norm && normalizeCatalogName(p.name) === norm) return p;
  }
  return null;
}

const cat = loadMergedPhysioZonesCatalog(root);
const matcher = buildMatcher(cat);

const byCode = new Map<string, Agg>();
for (const p of procs) {
  byCode.set(p.code, {
    code: p.code,
    name: p.name,
    woRows: 0,
    woFilled: 0,
    flagHits: Object.fromEntries(FIELD_COLS.map((f) => [f, 0])),
    unmatchedTreatments: new Map(),
  });
}

const unmatchedNameHits = new Map<string, number>();
let scannedCards = 0;
let scannedProcs = 0;
let mappedProcs = 0;
let unmappedProcs = 0;

if (!fs.existsSync(CARDS)) {
  console.error("Cards dump missing:", CARDS);
  process.exit(1);
}

const files = fs.readdirSync(CARDS).filter((f) => f.endsWith(".json"));
for (const f of files) {
  scannedCards += 1;
  let json: {
    slices?: { procedures?: Array<{ nahiye?: unknown; treatmentName?: string | null }> };
  };
  try {
    json = JSON.parse(fs.readFileSync(path.join(CARDS, f), "utf8"));
  } catch {
    continue;
  }
  const slices = json.slices?.procedures;
  if (!Array.isArray(slices)) continue;
  for (const node of slices) {
    if (!node || typeof node !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(node, "nahiye")) continue;
    scannedProcs += 1;
    const tName = String(node.treatmentName || "").trim() || "(no name)";
    const resolved = resolveProc(tName);
    if (!resolved) {
      unmappedProcs += 1;
      unmatchedNameHits.set(tName, (unmatchedNameHits.get(tName) || 0) + 1);
      continue;
    }
    mappedProcs += 1;
    const agg = byCode.get(resolved.code)!;
    agg.woRows += 1;
    const raw = node.nahiye == null ? "" : String(node.nahiye).trim();
    if (!raw) continue;
    agg.woFilled += 1;
    const m = matcher.match(raw, { procedureName: tName });
    for (const flag of m.flags) {
      if (flag in agg.flagHits) agg.flagHits[flag] += 1;
    }
  }
}

/**
 * FO locked 2026-09: WO text still matches these flags, but the order form
 * must not grow a field. Report as fo_locked (not gap_gate).
 */
/**
 * FO locked 2026-09-04: WO may still match these, form deliberately omits.
 * IR/Sollyuks substance+oil opened after FO confirm — removed from this list.
 */
const FO_LOCKED_GAPS: Record<string, string[]> = {
  "SVC-NAFTALAN-VANNASI-QADIN": [
    "SMEAR",
    "APPLICATION_SURFACE",
    "DEVICE_PARAMS",
    "DEVICE_PROGRAM",
    "HOLD_OR_STOP",
  ],
  "SVC-NAFTALAN-VANNASI-KISI": [
    "SMEAR",
    "APPLICATION_SURFACE",
    "DEVICE_PARAMS",
    "DEVICE_PROGRAM",
    "HOLD_OR_STOP",
  ],
  "SVC-ELEKTROTERAPIYA": ["AMPLIPULS_WORK_KIND"],
  "SVC-KARBOKSITERAPIYA": ["LATERALITY"],
  "SVC-ULTRAFONOFOREZ": ["SMEAR"],
};

type CellKind = "ok" | "gap_gate" | "gap_wo" | "idle" | "fo_locked";

type RowOut = {
  procedure: string;
  procedureCode: string;
  woRows: number;
  woFilled: number;
  gateFields: string[];
  cells: Record<string, { wo: number; gate: boolean; kind: CellKind }>;
};

const rows: RowOut[] = [];
let okN = 0;
let gapGateN = 0;
let gapWoN = 0;
let foLockedN = 0;

for (const p of procs) {
  const gate = inferPhysioTypeGate(p.code, p.name);
  const gateSet = new Set<string>(gate.fields);
  const foIgnore = new Set(FO_LOCKED_GAPS[p.code] ?? []);

  const agg = byCode.get(p.code)!;
  const cells: RowOut["cells"] = {};
  for (const f of FIELD_COLS) {
    const wo = agg.flagHits[f] || 0;
    const inGate = gateSet.has(f);
    const matcherOnly = (EXTRA_MATCHER_FLAGS as readonly string[]).includes(f);
    let kind: CellKind = "idle";
    if (matcherOnly) {
      kind = wo > 0 ? "ok" : "idle";
    } else if (inGate && wo > 0) {
      kind = "ok";
      okN += 1;
    } else if (!inGate && wo > 0 && foIgnore.has(f)) {
      kind = "fo_locked";
      foLockedN += 1;
    } else if (!inGate && wo > 0) {
      kind = "gap_gate";
      gapGateN += 1;
    } else if (inGate && wo === 0) {
      kind = "gap_wo";
      gapWoN += 1;
    }
    cells[f] = { wo, gate: inGate, kind };
  }
  rows.push({
    procedure: p.name,
    procedureCode: p.code,
    woRows: agg.woRows,
    woFilled: agg.woFilled,
    gateFields: [...gateSet],
    cells,
  });
}

rows.sort((a, b) => a.procedure.localeCompare(b.procedure, "az", { sensitivity: "base" }));

type UnmappedBucket =
  | "junk"
  | "visit"
  | "retired_infusion"
  | "known_non_physio"
  | "needs_alias_or_sku";

function classifyUnmappedName(raw: string): UnmappedBucket {
  const n = normalizeCatalogName(raw);
  if (!n || /^(kohne|kohne \d+)$/.test(n) || n === "-" || /^-\s/.test(raw.trim())) return "junk";
  // FO: Massaj 15 (test) and similar WO test rows — not real bookings
  if (/\btest\b/.test(n)) return "junk";
  if (
    /qebul|muayine|muayinesi|hekimin|bas hekim|terapevt|kardioloq|nevropatoloq|ekq/.test(n)
  ) {
    return "visit";
  }
  if (
    /venadaxili|inyeksi|infuzi|infuziiya|ezele|metobalik|metabolik|sistem .*qonaq|sistem .*otel|laennec/.test(
      n,
    )
  ) {
    return "retired_infusion";
  }
  if (/reflekso|iyne batirma|osteopat|manual|prolo/.test(n)) {
    // reflexology deliberately not in physio types; others should map after alias/SKU
    if (/reflekso|iyne batirma/.test(n)) return "known_non_physio";
  }
  return "needs_alias_or_sku";
}

const unmatchedClassified = [...unmatchedNameHits.entries()]
  .map(([name, n]) => ({ name, n, bucket: classifyUnmappedName(name) }))
  .sort((a, b) => b.n - a.n);

const topUnmatchedActionable = unmatchedClassified
  .filter((x) => x.bucket === "needs_alias_or_sku")
  .slice(0, 25);
const topUnmatchedOutOfScope = unmatchedClassified
  .filter((x) => x.bucket !== "needs_alias_or_sku")
  .slice(0, 25);
const topUnmatched = unmatchedClassified.slice(0, 25).map(({ name, n, bucket }) => ({
  name,
  n,
  bucket,
}));

const gapGateList: Array<{ proc: string; field: string; wo: number }> = [];
const foLockedList: Array<{ proc: string; field: string; wo: number }> = [];
const gapWoList: Array<{ proc: string; field: string }> = [];
for (const r of rows) {
  for (const f of FIELD_COLS) {
    const c = r.cells[f];
    if (c.kind === "gap_gate") gapGateList.push({ proc: r.procedure, field: f, wo: c.wo });
    if (c.kind === "fo_locked") foLockedList.push({ proc: r.procedure, field: f, wo: c.wo });
    if (c.kind === "gap_wo" && r.woFilled > 20) gapWoList.push({ proc: r.procedure, field: f });
  }
}
gapGateList.sort((a, b) => b.wo - a.wo);
foLockedList.sort((a, b) => b.wo - a.wo);
gapWoList.sort((a, b) => a.proc.localeCompare(b.proc, "az"));

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Сверка WO flags ↔ gate fields</title>
<style>
:root {
  --bg:#f6f5f2; --card:#fff; --text:#1a1a1a; --muted:#5c5c5c; --border:#ddd8ce;
  --accent:#1f4b3a; --accent-soft:#e7f0eb; --ok:#dcefe6; --gap:#fde8e6; --sparse:#fff4e5; --idle:#f3f1ec; --fo:#e8e4f4;
}
* { box-sizing:border-box; }
html, body { height:100%; margin:0; }
body { font:13px/1.4 system-ui,Segoe UI,sans-serif; background:var(--bg); color:var(--text);
  display:flex; flex-direction:column; overflow:hidden; }
header { flex:0 0 auto; background:var(--card); border-bottom:1px solid var(--border); padding:12px 16px; z-index:20; }
h1 { margin:0 0 4px; font-size:17px; }
.sub { color:var(--muted); font-size:12px; margin-bottom:8px; max-width:1100px; }
.nav a { color:var(--accent); margin-right:12px; font-size:12px; }
.legend { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; font-size:12px; }
.lg { padding:3px 8px; border-radius:4px; }
.lg.ok { background:var(--ok); }
.lg.gap { background:var(--gap); }
.lg.sparse { background:var(--sparse); }
.lg.fo { background:var(--fo); }
.lg.idle { background:var(--idle); }
.filters { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px; }
label { display:flex; flex-direction:column; gap:3px; font-size:10px; color:var(--muted); text-transform:uppercase; }
select, input { padding:6px 8px; border:1px solid var(--border); border-radius:6px; font:inherit; }
.toolbar { display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap; }
.stat { background:var(--accent-soft); color:var(--accent); padding:3px 9px; border-radius:999px; font-size:12px; font-weight:600; }
button { border:1px solid var(--border); background:#fff; border-radius:6px; padding:6px 11px; cursor:pointer; font:inherit; }
main { flex:1 1 auto; overflow:auto; }
table { border-collapse:separate; border-spacing:0; background:var(--card); width:max-content; min-width:100%; }
th, td { padding:5px 7px; border-bottom:1px solid var(--border); border-right:1px solid var(--border); font-size:12px; white-space:nowrap; }
th { position:sticky; top:0; z-index:10; background:#f0ebe3; font-size:10px; text-transform:uppercase; color:var(--muted); box-shadow:0 1px 0 var(--border); }
th.proc, td.proc { position:sticky; left:0; z-index:11; background:var(--card); min-width:190px; white-space:normal; }
th.proc { z-index:12; background:#f0ebe3; }
td.ok { background:var(--ok); text-align:center; }
td.gap_gate { background:var(--gap); text-align:center; font-weight:650; }
td.gap_wo { background:var(--sparse); text-align:center; }
td.fo_locked { background:var(--fo); text-align:center; color:#4a3f72; }
td.idle { background:var(--idle); text-align:center; color:#bbb; }
.code { color:var(--muted); font-size:10px; font-family:ui-monospace,Consolas,monospace; }
.note { padding:10px 16px; font-size:12px; color:var(--muted); }
.lists { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px 16px; }
.lists section { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px; }
.lists h2 { margin:0 0 6px; font-size:13px; }
.lists li { font-size:12px; margin:2px 0; }
</style>
</head>
<body>
<header>
  <div class="nav">
    <a href="procedure-order-fields-matrix.html">← Слой 2: поля</a>
    <a href="procedure-form-matrix.html">Слой 1: зоны</a>
  </div>
  <h1>Сверка: WO matcher flags ↔ gate fields</h1>
  <div class="sub">Источник: dump cards <code>${CARDS}</code> (${scannedCards} карт).
  На каждый filled nahiye — <code>nahiye-s-match</code> → flags. Сравнение с <code>inferPhysioTypeGate</code>.
  Число в ячейке = сколько раз флаг встретился на этой процедуре.</div>
  <div class="legend">
    <span class="lg ok">ok — gate Y + WO&gt;0</span>
    <span class="lg gap">красное — ещё дыра формы (надо решать)</span>
    <span class="lg fo">фиолетовое — WO писал, форму не открываем (решение FO)</span>
    <span class="lg sparse">gap_wo — в gate есть, в WO 0 (при filled&gt;20 в списке)</span>
    <span class="lg idle">idle — оба пусто</span>
  </div>
  <div class="filters">
    <label>Поиск<input type="search" id="q" placeholder="процедура / поле"/></label>
    <label>Процедура<select id="fProc"><option value="">Все</option></select></label>
    <label>Только gaps<select id="fGap"><option value="">Все ячейки</option><option value="gap_gate">дыры формы</option><option value="fo_locked">FO закрыто</option><option value="gap_wo">gap_wo</option><option value="ok">ok</option></select></label>
    <label>Мин. WO rows<input type="number" id="fMin" value="0" min="0"/></label>
  </div>
  <div class="toolbar">
    <span class="stat" id="count"></span>
    <span class="stat">mapped ${mappedProcs} / unmapped ${unmappedProcs}</span>
    <span class="stat">ok ${okN}</span>
    <span class="stat">дыры формы ${gapGateN}</span>
    <span class="stat">FO закрыто ${foLockedN}</span>
    <span class="stat">gap_wo ${gapWoN}</span>
    <button type="button" id="reset">Сбросить</button>
  </div>
</header>
<main>
<table>
<thead>
<tr>
  <th class="proc">Процедура</th>
  <th>WO</th>
  <th>filled</th>
  ${FIELD_COLS.map((f) => `<th title="${f}">${FIELD_LABEL[f] || f}</th>`).join("")}
</tr>
</thead>
<tbody id="tbody"></tbody>
</table>
<div class="lists">
  <section>
    <h2>Дыры формы (красное) — ещё решать</h2>
    <ol id="gapGateList"></ol>
    <h2 style="margin-top:12px">FO закрыто (фиолетовое) — число в WO, поля на форме нет</h2>
    <ol id="foLockedList"></ol>
  </section>
  <section>
    <h2>Unmapped — нужно действие (alias/SKU)</h2>
    <ol id="unmappedActionable"></ol>
    <h2 style="margin-top:12px">Unmapped — вне physio (мусор / приём / снятые инфузии)</h2>
    <ol id="unmappedOut"></ol>
  </section>
</div>
<p class="note">SEQUENCE_* / APPLICATION_CUT / bleed — флаги матчера, не колонки gate (считаются ok при WO&gt;0).
  Unmapped out-of-scope не влияет на gap_gate. Скрипт: <code>scripts/_tmp_utf8/gen-wo-fields-reconcile.ts</code>.</p>
</main>
<script>
const ROWS = ${JSON.stringify(rows)};
const FIELD_COLS = ${JSON.stringify(FIELD_COLS)};
const GAP_GATE = ${JSON.stringify(gapGateList.slice(0, 40))};
const FO_LOCKED = ${JSON.stringify(foLockedList.slice(0, 40))};
const UNMAPPED_ACTIONABLE = ${JSON.stringify(topUnmatchedActionable)};
const UNMAPPED_OUT = ${JSON.stringify(topUnmatchedOutOfScope)};

const procSel = document.getElementById("fProc");
const gapSel = document.getElementById("fGap");
const minEl = document.getElementById("fMin");
const qEl = document.getElementById("q");
const tbody = document.getElementById("tbody");
const countEl = document.getElementById("count");

[...new Set(ROWS.map(r => r.procedure))].sort((a,b)=>a.localeCompare(b,"az")).forEach(n => {
  const o = document.createElement("option"); o.value = n; o.textContent = n; procSel.appendChild(o);
});
document.getElementById("gapGateList").innerHTML = GAP_GATE.length
  ? GAP_GATE.map(x =>
  "<li><strong>" + x.proc + "</strong> · " + x.field + " · WO " + x.wo + "</li>").join("")
  : "<li><em>нет открытых дыр</em></li>";
document.getElementById("foLockedList").innerHTML = FO_LOCKED.map(x =>
  "<li><strong>" + x.proc + "</strong> · " + x.field + " · WO " + x.wo + "</li>").join("");
document.getElementById("unmappedActionable").innerHTML = UNMAPPED_ACTIONABLE.length
  ? UNMAPPED_ACTIONABLE.map(x => "<li>" + x.name + " · " + x.n + "</li>").join("")
  : "<li><em>нет — aliases покрыли physio-имена</em></li>";
document.getElementById("unmappedOut").innerHTML = UNMAPPED_OUT.map(x =>
  "<li><span class=\\"code\\">[" + x.bucket + "]</span> " + x.name + " · " + x.n + "</li>").join("");

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function render() {
  const q = (qEl.value||"").trim().toLowerCase();
  const fp = procSel.value;
  const fg = gapSel.value;
  const minW = Number(minEl.value||0);
  const filtered = ROWS.filter(r => {
    if (fp && r.procedure !== fp) return false;
    if (r.woRows < minW) return false;
    if (fg && !Object.values(r.cells).some(c => c.kind === fg)) return false;
    if (q) {
      const hay = [r.procedure, r.procedureCode, ...Object.keys(r.cells).filter(f => r.cells[f].wo>0 || r.cells[f].gate)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  countEl.textContent = filtered.length + " / " + ROWS.length + " процедур";
  tbody.innerHTML = filtered.map(r => {
    const cells = FIELD_COLS.map(f => {
      const c = r.cells[f];
      if (c.kind === "idle") return '<td class="idle">·</td>';
      return '<td class="' + c.kind + '" title="' + f + ' gate=' + c.gate + ' wo=' + c.wo + '">' +
        (c.wo > 0 ? c.wo : (c.gate ? "G" : "·")) + "</td>";
    }).join("");
    return '<tr><td class="proc"><div><strong>' + esc(r.procedure) + '</strong></div>' +
      '<div class="code">' + esc(r.procedureCode) + "</div></td>" +
      "<td>" + r.woRows + "</td><td>" + r.woFilled + "</td>" + cells + "</tr>";
  }).join("");
}
["input","change"].forEach(ev => {
  qEl.addEventListener(ev, render); procSel.addEventListener(ev, render);
  gapSel.addEventListener(ev, render); minEl.addEventListener(ev, render);
});
document.getElementById("reset").onclick = () => {
  qEl.value=""; procSel.value=""; gapSel.value=""; minEl.value="0"; render();
};
render();
</script>
</body>
</html>
`;

const outPath = path.join(root, "doc/wo-fields-reconcile.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
console.log({ scannedCards, scannedProcs, mappedProcs, unmappedProcs, okN, gapGateN, foLockedN, gapWoN });
console.log("open form gaps", gapGateList);
console.log("fo locked", foLockedList.slice(0, 15));
console.log(
  "unmapped actionable",
  topUnmatchedActionable.slice(0, 10),
);
console.log(
  "unmapped out-of-scope",
  topUnmatchedOutOfScope.slice(0, 10),
);
