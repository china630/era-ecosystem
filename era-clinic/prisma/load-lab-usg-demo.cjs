/**
 * Idempotent demo seed: lab panels + USG imaging orders for every PatientRef.
 * Marker: telehealthUrl = DEMO_MARKER (safe to re-run; does not wipe other orders).
 *
 * Status mix (~per patient index):
 *   0 ORDERED / 1 COLLECTED  -> pending (no results)
 *   2 RESULT_READY / 3 PUBLISHED / 4 COMPLETED -> with resultJson
 *
 * Run: node prisma/load-lab-usg-demo.cjs
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DEMO_MARKER = "demo:lab-usg-v1";

const LAB_CODES = ["LAB-CBC", "LAB-BIOCHEM", "LAB-LIPID", "LAB-THYROID", "LAB-URINE", "LAB-LIVER"];
const USG_CODES = ["USG-ABD", "USG-THYROID", "USG-KIDNEY", "USG-SOFT", "USG-PELVIC"];
const USG_MALE = ["USG-ABD", "USG-THYROID", "USG-KIDNEY", "USG-PROSTATE", "USG-SOFT"];
const USG_FEMALE = ["USG-ABD", "USG-THYROID", "USG-KIDNEY", "USG-PELVIC", "USG-BREAST"];

const AMOUNTS = {
  "LAB-CBC": 25,
  "LAB-BIOCHEM": 45,
  "LAB-LIPID": 35,
  "LAB-THYROID": 40,
  "LAB-URINE": 15,
  "LAB-LIVER": 30,
  "USG-ABD": 40,
  "USG-THYROID": 35,
  "USG-KIDNEY": 35,
  "USG-SOFT": 30,
  "USG-PELVIC": 40,
  "USG-PROSTATE": 40,
  "USG-BREAST": 45,
};

function loadCatalogIndex() {
  const catalogPath = path.join(__dirname, "seed-data", "diagnostic-lab-catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const byCode = new Map();
  for (const panel of catalog.labPanels || []) {
    byCode.set(panel.code, { kind: "lab_panel", analytes: panel.analytes || [], fields: [] });
  }
  for (const mod of catalog.modalities || []) {
    for (const t of mod.templates || []) {
      byCode.set(t.code, { kind: "imaging", analytes: [], fields: t.fields || [] });
    }
  }
  return byCode;
}

function enrich(lines) {
  return lines.map((line) => {
    if (line.flag === "CRITICAL") return line;
    const num = parseFloat(line.value);
    const min = line.refMin != null ? parseFloat(line.refMin) : NaN;
    const max = line.refMax != null ? parseFloat(line.refMax) : NaN;
    let flag = line.flag || "NORMAL";
    if (!Number.isNaN(num) && !Number.isNaN(min) && num < min) {
      flag = num < min * 0.5 ? "CRITICAL" : "LOW";
    }
    if (!Number.isNaN(num) && !Number.isNaN(max) && num > max) {
      flag = num > max * 1.5 ? "CRITICAL" : "HIGH";
    }
    return Object.assign({}, line, { flag: flag });
  });
}

function jitter(base, spread, seed) {
  const n = Number(base);
  if (Number.isNaN(n)) return String(base);
  const delta = ((seed % 17) - 8) * (spread / 8);
  const v = Math.max(0, n + delta);
  return Number.isInteger(n) ? String(Math.round(v)) : v.toFixed(1);
}

function labResultLines(analytes, seed) {
  const defaults = {
    WBC: "6.2",
    RBC: "4.5",
    HGB: "138",
    HCT: "41",
    PLT: "240",
    "NEUT%": "58",
    "LYMPH%": "32",
    "MONO%": "7",
    "EOS%": "2",
    "BASO%": "1",
    ESR: "12",
    GLU: "5.2",
    UREA: "5.1",
    CREA: "72",
    UA: "310",
    TBIL: "12.0",
    DBIL: "3.2",
    ALT: "28",
    AST: "24",
    ALP: "78",
    GGT: "32",
    TP: "72",
    ALB: "42",
    CHOL: "5.1",
    HDL: "1.4",
    LDL: "3.2",
    TRIG: "1.5",
    APOB: "0.9",
    LPA: "45",
    TSH: "2.1",
    FT4: "15.2",
    FT3: "4.5",
    "ANTI-TPO": "12",
    SG: "1.015",
    PH: "6.0",
    LEU: "neg",
    NIT: "neg",
    PRO: "neg",
    GLU_U: "neg",
    KET: "neg",
    BLD: "neg",
    URO: "norm",
    BIL: "neg",
  };
  return enrich(
    analytes.map((a, i) => {
      let base = defaults[a.code];
      if (base == null) {
        if (a.refMin && a.refMax) {
          base = String((parseFloat(a.refMin) + parseFloat(a.refMax)) / 2);
        } else {
          base = "ok";
        }
      }
      const numeric = !Number.isNaN(parseFloat(base));
      const value = numeric
        ? jitter(base, Math.max(0.3, parseFloat(base) * 0.08), seed + i)
        : base;
      return {
        code: a.code,
        value: value,
        unit: a.unit,
        refMin: a.refMin,
        refMax: a.refMax,
      };
    }),
  );
}

function usgResultLines(fields, seed, patientName) {
  const templates = {
    liver: "Normal size and echogenicity. No focal lesions.",
    gallbladder: "Thin walls, no stones. CBD not dilated.",
    pancreas: "Homogeneous, no duct dilatation.",
    spleen: "Normal size.",
    freeFluid: "none",
    conclusion: "No acute pathology.",
    recommendations: "Follow-up as clinically indicated.",
    rightKidney: "Normal size, no hydronephrosis.",
    leftKidney: "Normal size, no stones.",
    bladder: "Adequate filling, thin walls.",
    thyroid: "Isthmus and lobes within normal limits.",
    rightLobe: "Homogeneous parenchyma.",
    leftLobe: "Homogeneous parenchyma.",
    nodes: "No suspicious lymph nodes.",
    parenchyma: "Homogeneous soft tissue.",
    prostate: "Volume within age norms.",
    uterus: "Normal size and contours.",
    ovaries: "No cystic masses.",
    breast: "BI-RADS 1 - negative.",
  };
  const lines = [
    { code: "meta.indication", value: "Sanatorium checkup" },
    { code: "meta.studyDate", value: new Date().toISOString().slice(0, 10) },
    { code: "meta.performer", value: "Dr. Demo USG" },
    { code: "meta.device", value: "USG-1" },
  ];
  for (const f of fields) {
    let value = templates[f.key];
    if (!value && f.type === "select" && f.options && f.options.length) {
      value = f.options[seed % f.options.length];
    }
    if (!value && f.key === "conclusion") {
      value = "Findings unremarkable for " + patientName + ".";
    }
    if (!value) value = "Within normal limits.";
    lines.push({ code: f.key, value: value });
  }
  return lines;
}

function statusFor(index, kind) {
  const bucket = (index + (kind === "usg" ? 1 : 0)) % 5;
  if (bucket === 0) return "ORDERED";
  if (bucket === 1) return "COLLECTED";
  if (bucket === 2) return "RESULT_READY";
  if (bucket === 3) return "PUBLISHED";
  return "COMPLETED";
}

function timestampsFor(status, createdAt) {
  const collectedAt =
    status === "ORDERED" ? null : new Date(createdAt.getTime() + 30 * 60 * 1000);
  const publishedAt =
    status === "PUBLISHED" || status === "COMPLETED"
      ? new Date(createdAt.getTime() + 4 * 60 * 60 * 1000)
      : null;
  const completedAt =
    status === "COMPLETED" ? new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) : null;
  return { collectedAt: collectedAt, publishedAt: publishedAt, completedAt: completedAt };
}

function pickUsg(patient, index) {
  if (patient.sex === "MALE") return USG_MALE[index % USG_MALE.length];
  if (patient.sex === "FEMALE") return USG_FEMALE[index % USG_FEMALE.length];
  return USG_CODES[index % USG_CODES.length];
}

async function main() {
  const catalog = loadCatalogIndex();
  const patients = await prisma.patientRef.findMany({
    where: process.env.DEMO_WEEK_ONLY === "1" ? { refCode: { startsWith: "DEMO-WEEK-" } } : undefined,
    orderBy: { refCode: "asc" },
    select: { id: true, refCode: true, fullName: true, sex: true },
  });
  if (patients.length === 0) {
    console.log("[lab-usg-demo] no patients - skip");
    return;
  }

  const deleted = await prisma.labOrder.deleteMany({
    where: { telehealthUrl: DEMO_MARKER },
  });
  console.log("[lab-usg-demo] cleared previous demo rows: " + deleted.count);

  const rows = [];
  const now = Date.now();

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    const createdAt = new Date(now - (i % 14) * 24 * 60 * 60 * 1000 - (i % 9) * 3600 * 1000);

    const labCode = LAB_CODES[i % LAB_CODES.length];
    const labStatus = statusFor(i, "lab");
    const labMeta = catalog.get(labCode);
    const labHasResult = labStatus !== "ORDERED" && labStatus !== "COLLECTED";
    const labTs = timestampsFor(labStatus, createdAt);
    rows.push({
      patientRefId: patient.id,
      testCode: labCode,
      status: labStatus,
      amountNet: AMOUNTS[labCode] != null ? AMOUNTS[labCode] : 20,
      resultJson:
        labHasResult && labMeta && labMeta.analytes && labMeta.analytes.length
          ? JSON.stringify(labResultLines(labMeta.analytes, i * 3 + 1))
          : null,
      collectedAt: labTs.collectedAt,
      publishedAt: labTs.publishedAt,
      completedAt: labTs.completedAt,
      telehealthUrl: DEMO_MARKER,
      createdAt: createdAt,
    });

    const usgCode = pickUsg(patient, i);
    const usgStatus = statusFor(i, "usg");
    const usgMeta = catalog.get(usgCode);
    const usgHasResult = usgStatus !== "ORDERED" && usgStatus !== "COLLECTED";
    const usgCreated = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    const usgTs = timestampsFor(usgStatus, usgCreated);
    rows.push({
      patientRefId: patient.id,
      testCode: usgCode,
      status: usgStatus,
      amountNet: AMOUNTS[usgCode] != null ? AMOUNTS[usgCode] : 35,
      resultJson:
        usgHasResult && usgMeta && usgMeta.fields && usgMeta.fields.length
          ? JSON.stringify(usgResultLines(usgMeta.fields, i, patient.fullName))
          : null,
      collectedAt: usgTs.collectedAt,
      publishedAt: usgTs.publishedAt,
      completedAt: usgTs.completedAt,
      telehealthUrl: DEMO_MARKER,
      createdAt: usgCreated,
    });
  }

  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.labOrder.createMany({ data: rows.slice(i, i + chunk) });
  }

  const byStatus = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  console.log(
    "[lab-usg-demo] patients=" +
      patients.length +
      " orders=" +
      rows.length +
      " statuses=" +
      JSON.stringify(byStatus),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
