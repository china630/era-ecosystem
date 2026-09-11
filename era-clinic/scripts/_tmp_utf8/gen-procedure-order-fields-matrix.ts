/**
 * Rebuild era-clinic/doc/procedure-order-fields-matrix.html
 * Layer 2: procedure × type-gated physioOrderFields (+ needsSite / hints).
 * Usage: npx tsx scripts/_tmp_utf8/gen-procedure-order-fields-matrix.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PHYSIO_ORDER_FIELD_CODES } from "../../src/domain/physio/physio-order-fields";
import { inferPhysioTypeGate } from "../../src/domain/physio/physio-type-gate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const procs = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/procedure-types.json"), "utf8"),
) as Array<{ code: string; name: string }>;

const FIELD_LABEL_RU: Record<string, string> = {
  LATERALITY: "L/R/BOTH",
  AMPLIPULS_WORK_KIND: "Amplipuls I–V",
  DEVICE_PROGRAM: "Программа аппарата",
  ELECTRODE_COUNT: "Электроды 2/4",
  DEVICE_PARAMS: "Параметры прибора",
  NO_ADDITIVE: "Без добавки (sadə)",
  APPLICATION_SURFACE: "Поверхность (ön/arxa…)",
  SUBSTANCE_OR_ADDITIVE: "Препарат",
  EXTRA_OIL: "Доп. масло",
  HOLD_OR_STOP: "Стоп / без давления",
  SPINE_LEVEL: "Уровень позв.",
  DAY_BLOCK: "Блок дней",
  BATH_SEQUENCE: "Ванна по дням",
  NAFTALAN_FILL: "Fill tam/oturaq/qurşaq",
  INTENSITY: "Интенсивность",
  SMEAR: "Smear / sürtülsün",
};

/** FO planned fields not yet distinguishable from gate — keep empty after WO reconcile wave. */
const FO_FIELD_OVERLAY: Record<string, string[]> = {};

type Row = {
  procedure: string;
  procedureCode: string;
  needsSite: boolean;
  siteCount: number;
  sites: string;
  forceTogether: boolean;
  hint: string;
  fields: string[];
  fieldSet: Record<string, boolean>;
  foExtra: string[];
};

const rows: Row[] = procs
  .map((p) => {
    const gate = inferPhysioTypeGate(p.code, p.name);
    const foExtra = (FO_FIELD_OVERLAY[p.code] ?? []).filter((f) => !gate.fields.includes(f as never));
    const allFields = [...gate.fields, ...foExtra];
    const fieldSet: Record<string, boolean> = {};
    for (const f of PHYSIO_ORDER_FIELD_CODES) fieldSet[f] = allFields.includes(f);
    return {
      procedure: p.name,
      procedureCode: p.code,
      needsSite: gate.needsSite,
      siteCount: gate.allowedSiteCodes.length,
      sites: gate.allowedSiteCodes.join(", ") || "—",
      forceTogether: gate.forceSiteTogether,
      hint: gate.sitesHintKey ?? "",
      fields: allFields,
      fieldSet,
      foExtra,
    };
  })
  .sort((a, b) => a.procedure.localeCompare(b.procedure, "az", { sensitivity: "base" }));

const procOpts = rows.map((r) => r.procedure);
const fieldCols = [...PHYSIO_ORDER_FIELD_CODES];

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Процедура → поля заказа (слой 2)</title>
<style>
:root {
  --bg:#f6f5f2; --card:#fff; --text:#1a1a1a; --muted:#5c5c5c; --border:#ddd8ce;
  --accent:#1f4b3a; --accent-soft:#e7f0eb; --chip:#efeae2; --warn:#fff4e5; --yes:#dcefe6; --fo:#fff0d6;
}
* { box-sizing:border-box; }
html, body { height:100%; margin:0; }
body {
  font:13px/1.4 system-ui,Segoe UI,sans-serif; background:var(--bg); color:var(--text);
  display:flex; flex-direction:column; overflow:hidden;
}
header {
  flex:0 0 auto; background:var(--card); border-bottom:1px solid var(--border);
  padding:12px 16px 10px; z-index:20;
}
h1 { margin:0 0 4px; font-size:17px; font-weight:650; }
.sub { color:var(--muted); font-size:12px; margin-bottom:10px; max-width:1100px; }
.nav { margin-bottom:8px; font-size:12px; }
.nav a { color:var(--accent); margin-right:12px; }
.filters { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:8px; }
label { display:flex; flex-direction:column; gap:3px; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.03em; }
select, input[type=search] { width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:#fff; font:inherit; }
.toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
.stat { background:var(--accent-soft); color:var(--accent); padding:3px 9px; border-radius:999px; font-size:12px; font-weight:600; }
button { border:1px solid var(--border); background:#fff; border-radius:6px; padding:6px 11px; cursor:pointer; font:inherit; }
button:hover { background:var(--chip); }
main { flex:1 1 auto; overflow:auto; padding:0 0 24px; }
.table-wrap { min-width:100%; }
table { width:max-content; min-width:100%; border-collapse:separate; border-spacing:0; background:var(--card); }
th, td { padding:6px 8px; border-bottom:1px solid var(--border); border-right:1px solid var(--border); vertical-align:middle; text-align:left; white-space:nowrap; }
th {
  position:sticky; top:0; z-index:10; background:#f0ebe3;
  font-size:10px; text-transform:uppercase; letter-spacing:.03em; color:var(--muted);
  box-shadow:0 1px 0 var(--border);
}
th.proc, td.proc { position:sticky; left:0; z-index:11; background:var(--card); min-width:200px; max-width:260px; white-space:normal; }
th.proc { z-index:12; background:#f0ebe3; }
tr:hover td { background:#faf8f4; }
tr:hover td.proc { background:#f5f1ea; }
.code { color:var(--muted); font-size:10px; font-family:ui-monospace,Consolas,monospace; }
.y { background:var(--yes); text-align:center; font-weight:650; color:var(--accent); }
.y.fo { background:var(--fo); color:#8a5a00; }
.n { color:#ccc; text-align:center; }
.chip { display:inline-block; background:var(--chip); border-radius:4px; padding:1px 5px; margin:1px 2px 1px 0; font-size:11px; }
.chip.hint { background:var(--warn); }
.note { padding:10px 16px; font-size:12px; color:var(--muted); max-width:1000px; }
</style>
</head>
<body>
<header>
  <div class="nav">
    <a href="procedure-form-matrix.html">← Слой 1: зоны / препараты</a>
    <a href="wo-fields-reconcile.html">Сверка WO ↔ gate →</a>
  </div>
  <h1>Слой 2 — процедура → поля заказа (WO type-gated)</h1>
  <div class="sub">Каждая колонка = <code>physioOrderFields</code> из <code>inferPhysioTypeGate</code>.
  Жёлтый <strong>Y*</strong> = FO уже решил, в gate ещё не зашито (4-камера → препарат).
  TURN/TOGETHER = <code>forceSiteTogether</code> / UI при ≥2 зонах (не отдельный field code).
  Сырой <code>nahiye</code> / <code>note</code> — всегда, вне матрицы.</div>
  <div class="filters">
    <label>Поиск<input type="search" id="q" placeholder="процедура, поле…"/></label>
    <label>Процедура<select id="fProc"><option value="">Все</option></select></label>
    <label>Нужны зоны<select id="fSite"><option value="">Все</option><option value="1">Да</option><option value="0">Нет</option></select></label>
    <label>Есть поле<select id="fField"><option value="">Любое</option></select></label>
    <label>Только с полями<select id="fAny"><option value="">Все</option><option value="1">С ≥1 полем</option><option value="0">Без полей</option></select></label>
  </div>
  <div class="toolbar">
    <span class="stat" id="count"></span>
    <button type="button" id="reset">Сбросить</button>
  </div>
</header>
<main>
<div class="table-wrap">
<table>
<thead>
<tr>
  <th class="proc">Процедура</th>
  <th>Зоны</th>
  <th>#S</th>
  <th>Together</th>
  <th>Hint</th>
  ${fieldCols.map((f) => `<th title="${f}">${FIELD_LABEL_RU[f] || f}</th>`).join("")}
</tr>
</thead>
<tbody id="tbody"></tbody>
</table>
</div>
<p class="note">Источник: gate в коде. Препараты (слой 1 allowlist) сюда не дублируем значениями — только флаг SUBSTANCE_OR_ADDITIVE.
  Следующий шаг после ревью: зашить FO (4-камера SUBSTANCE, multi substanceIds, BERODUAL/SALINE seed).</p>
</main>
<script>
const ROWS = ${JSON.stringify(rows)};
const PROC_OPTS = ${JSON.stringify(procOpts)};
const FIELD_COLS = ${JSON.stringify(fieldCols)};
const FIELD_LABEL = ${JSON.stringify(FIELD_LABEL_RU)};
const FO_EXTRA = ${JSON.stringify(Object.fromEntries(rows.map((r) => [r.procedureCode, r.foExtra])))};

const procSel = document.getElementById("fProc");
const siteSel = document.getElementById("fSite");
const fieldSel = document.getElementById("fField");
const anySel = document.getElementById("fAny");
const qEl = document.getElementById("q");
const tbody = document.getElementById("tbody");
const countEl = document.getElementById("count");

PROC_OPTS.forEach((n) => {
  const o = document.createElement("option");
  o.value = n; o.textContent = n; procSel.appendChild(o);
});
FIELD_COLS.forEach((f) => {
  const o = document.createElement("option");
  o.value = f; o.textContent = (FIELD_LABEL[f] || f) + " (" + f + ")";
  fieldSel.appendChild(o);
});

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function render() {
  const q = (qEl.value || "").trim().toLowerCase();
  const fp = procSel.value;
  const fs = siteSel.value;
  const ff = fieldSel.value;
  const fa = anySel.value;
  const filtered = ROWS.filter((r) => {
    if (fp && r.procedure !== fp) return false;
    if (fs === "1" && !r.needsSite) return false;
    if (fs === "0" && r.needsSite) return false;
    if (ff && !r.fieldSet[ff]) return false;
    if (fa === "1" && r.fields.length === 0) return false;
    if (fa === "0" && r.fields.length > 0) return false;
    if (q) {
      const hay = [r.procedure, r.procedureCode, r.sites, r.hint, ...r.fields].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  countEl.textContent = filtered.length + " / " + ROWS.length + " процедур";
  tbody.innerHTML = filtered.map((r) => {
    const fo = FO_EXTRA[r.procedureCode] || [];
    const cells = FIELD_COLS.map((f) => {
      if (!r.fieldSet[f]) return '<td class="n">·</td>';
      const planned = fo.includes(f);
      return planned
        ? '<td class="y fo" title="FO planned, not in gate yet">Y*</td>'
        : '<td class="y">Y</td>';
    }).join("");
    return "<tr>" +
      '<td class="proc"><div><strong>' + esc(r.procedure) + '</strong></div><div class="code">' + esc(r.procedureCode) + "</div></td>" +
      '<td><span class="chip">' + (r.needsSite ? "S" : "no-S") + "</span> " +
        '<span class="code">' + esc(r.sites.length > 48 ? r.sites.slice(0, 48) + "…" : r.sites) + "</span></td>" +
      "<td>" + r.siteCount + "</td>" +
      "<td>" + (r.forceTogether ? '<span class="chip">TOGETHER</span>' : "—") + "</td>" +
      "<td>" + (r.hint ? '<span class="chip hint">' + esc(r.hint) + "</span>" : "—") + "</td>" +
      cells +
      "</tr>";
  }).join("");
}

["input", "change"].forEach((ev) => {
  qEl.addEventListener(ev, render);
  procSel.addEventListener(ev, render);
  siteSel.addEventListener(ev, render);
  fieldSel.addEventListener(ev, render);
  anySel.addEventListener(ev, render);
});
document.getElementById("reset").onclick = () => {
  qEl.value = ""; procSel.value = ""; siteSel.value = ""; fieldSel.value = ""; anySel.value = "";
  render();
};
render();
</script>
</body>
</html>
`;

const outPath = path.join(root, "doc/procedure-order-fields-matrix.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath, "procs", rows.length);
const withFo = rows.filter((r) => r.foExtra.length);
console.log(
  "FO overlays",
  withFo.map((r) => r.procedureCode + ":" + r.foExtra.join("+")).join(", ") || "none",
);
