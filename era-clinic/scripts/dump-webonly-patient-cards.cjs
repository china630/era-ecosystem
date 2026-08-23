/**
 * Dump Nafta WebOnly clinic patient cards via the public clinic API.
 *
 * Source UI: https://nafta-admin.webonly.io/en/dashboard/clinic/patients
 * Source API: https://nafta-clinic.webonly.io (OpenAPI /swagger/v1/swagger.json)
 *
 * Writes PII locally. Default out dir is D:\ERA-BACKUP\… — never commit the dump.
 *
 *   node era-clinic/scripts/dump-webonly-patient-cards.cjs
 *   node era-clinic/scripts/dump-webonly-patient-cards.cjs --with-files
 *   node era-clinic/scripts/dump-webonly-patient-cards.cjs --limit 20
 *   node era-clinic/scripts/dump-webonly-patient-cards.cjs --out "D:\\ERA-BACKUP\\wo-clinic"
 */

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const CLINIC_BASE = process.env.WO_CLINIC_API || "https://nafta-clinic.webonly.io";
const DEFAULT_OUT = path.join(
  "D:",
  "ERA-BACKUP",
  "NAFTA-START",
  "clinic",
  "dump",
);

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const next = args[i + 1];
  if (!next || next.startsWith("--")) return true;
  return next;
}

const OUT_DIR = path.resolve(String(flag("--out", process.env.WO_DUMP_DIR || DEFAULT_OUT)));
const CONCURRENCY = Number(flag("--concurrency", 6));
const LIMIT = Number(flag("--limit", 0)) || 0;
const WITH_FILES = Boolean(flag("--with-files", false));
const SKIP_CARDS = Boolean(flag("--skip-cards", false));
const SKIP_BULK = Boolean(flag("--skip-bulk", false));

const agent = new https.Agent({ keepAlive: true, maxSockets: CONCURRENCY + 2 });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function request(url, { method = "GET", headers = {}, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        agent,
        headers: {
          "User-Agent": "era-clinic-webonly-cutover-dump/1.0",
          Accept: "application/json, application/pdf, */*",
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
            const next = new URL(res.headers.location, url).toString();
            request(next, { method, headers, maxRedirects: maxRedirects - 1 }).then(resolve, reject);
            return;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(60_000, () => {
      req.destroy(new Error(`timeout ${url}`));
    });
    req.end();
  });
}

async function requestRetry(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await request(url, opts);
      if (r.status === 429 || r.status >= 500) {
        last = new Error(`HTTP ${r.status} ${url}`);
        await sleep(400 * 2 ** i);
        continue;
      }
      return r;
    } catch (e) {
      last = e;
      await sleep(400 * 2 ** i);
    }
  }
  throw last;
}

function unwrap(body) {
  if (!body || !body.length) return null;
  const text = body.toString("utf8");
  if (!text.trim()) return null;
  const j = JSON.parse(text);
  if (Array.isArray(j)) return j;
  if (j && Object.prototype.hasOwnProperty.call(j, "data")) return j.data;
  return j;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countOf(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return 1;
  return value == null ? 0 : 1;
}

const BULK = [
  ["catalogs/doctors.json", "/api/Doctors"],
  ["catalogs/diagnoses.json", "/api/Diagnoses"],
  ["catalogs/treatments.json", "/api/Treatment/get-all"],
  ["catalogs/checkups.json", "/api/CheckUp/get-all"],
  ["catalogs/rooms.json", "/api/Rooms"],
  ["catalogs/body-parts.json", "/api/BodyParts/get-all"],
  ["catalogs/pain-types.json", "/api/PainTypes/get-all"],
  ["catalogs/analyses.json", "/api/Analyses"],
  ["catalogs/diagnostic-procedures.json", "/api/DiagnosticProcedure/get-all"],
  ["catalogs/diagnostic-procedure-groups.json", "/api/DiagnosticProcedureGroup/get-all"],
  ["catalogs/laboratory-examinations.json", "/api/LaboratoryExamination/get-all"],
  ["catalogs/laboratory-examination-groups.json", "/api/LaboratoryExaminationGroup/get-all"],
  ["catalogs/pain-assessments.json", "/api/PainAssessments/get-all"],
  ["bulk/patients.json", "/api/Patient/get-all"],
  ["bulk/examination-forms.json", "/api/ExaminationForms"],
  ["bulk/archive.json", "/api/Archive/get-all"],
  ["bulk/treatment-info.json", "/api/TreatmentInfo/get-all"],
  ["bulk/lab-results.json", "/api/LabResult/get-all"],
  ["bulk/lab-tests.json", "/api/LabTests/getall"],
  ["bulk/prescriptions.json", "/api/Prescriptions/get-all"],
];

const CARD_SLICES = [
  ["patient", (id) => `/api/Patient/${id}`],
  ["examinationDiagnoses", (id) => `/api/ExaminationForms/patient/${id}/diagnoses`],
  ["procedures", (id) => `/api/PatientProcedure/get-all/${id}`],
  ["diagnostics", (id) => `/api/PatientDiagnostic/patient/${id}`],
  ["analiz", (id) => `/api/PatientAnaliz/patient/${id}`],
  ["bodyParts", (id) => `/api/PatientBodyParts/${id}`],
  ["painAssessment", (id) => `/api/PainAssessments/patient/${id}`],
  ["painDegrees", (id) => `/api/PainDegrees/by-patient/${id}`],
  ["labTests", (id) => `/api/LabTests/by-patient/${id}`],
  ["labResults", (id) => `/api/LabResult/by-patient/${id}`],
  ["prescriptions", (id) => `/api/Prescriptions/by-patient/${id}`],
  ["archivePdfs", (id) => `/api/Archive/patient/${id}/pdf/list`],
];

async function mapPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let i = 0;
  async function pump() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pump));
  return out;
}

function collectPatientIds(patients, archive) {
  const ids = new Set();
  for (const row of patients || []) {
    if (typeof row?.id === "number") ids.add(row.id);
  }
  for (const row of archive || []) {
    if (typeof row?.patientId === "number") ids.add(row.patientId);
  }
  return [...ids].sort((a, b) => a - b);
}

function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    const k = row?.[key];
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

async function dumpBulk(summary) {
  for (const [rel, ep] of BULK) {
    const dest = path.join(OUT_DIR, rel);
    process.stdout.write(`bulk ${ep} -> ${rel} ... `);
    const r = await requestRetry(CLINIC_BASE + ep);
    let data = null;
    try {
      data = unwrap(r.body);
    } catch {
      data = { _raw: r.body.toString("utf8").slice(0, 2000) };
    }
    writeJson(dest, {
      endpoint: ep,
      fetchedAt: new Date().toISOString(),
      httpStatus: r.status,
      count: countOf(data),
      data,
    });
    summary.bulk[rel] = { status: r.status, count: countOf(data) };
    console.log(`${r.status} count=${countOf(data)}`);
  }
}

function readBulk(rel) {
  const file = path.join(OUT_DIR, rel);
  if (!fs.existsSync(file)) return [];
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(j.data) ? j.data : [];
}

async function dumpCards(ids, summary) {
  const cardsDir = path.join(OUT_DIR, "cards");
  fs.mkdirSync(cardsDir, { recursive: true });
  const formsByPatient = indexBy(readBulk("bulk/examination-forms.json"), "patientId");
  const archiveByPatient = indexBy(readBulk("bulk/archive.json"), "patientId");
  const treatmentByName = indexBy(readBulk("bulk/treatment-info.json"), "patientFullName");
  const patientsById = new Map(readBulk("bulk/patients.json").map((p) => [p.id, p]));

  let done = 0;
  let errors = 0;
  await mapPool(ids, CONCURRENCY, async (id) => {
    const dest = path.join(cardsDir, `${id}.json`);
    if (fs.existsSync(dest)) {
      done += 1;
      if (done % 100 === 0) console.log(`cards ${done}/${ids.length} (resume)`);
      return;
    }
    const slices = {};
    const sliceStatus = {};
    for (const [name, build] of CARD_SLICES) {
      try {
        const r = await requestRetry(CLINIC_BASE + build(id));
        sliceStatus[name] = r.status;
        if (r.status === 204 || !r.body.length) {
          slices[name] = null;
        } else {
          try {
            slices[name] = unwrap(r.body);
          } catch {
            slices[name] = { _raw: r.body.toString("utf8").slice(0, 4000) };
          }
        }
      } catch (e) {
        sliceStatus[name] = "error";
        slices[name] = { _error: e.message };
        errors += 1;
      }
    }
    const listRow = patientsById.get(id) || null;
    const card = {
      patientId: id,
      fetchedAt: new Date().toISOString(),
      listRow,
      archiveRows: archiveByPatient.get(id) || [],
      examinationFormsBulk: formsByPatient.get(id) || [],
      treatmentInfoBulk: listRow?.fullName ? treatmentByName.get(listRow.fullName) || [] : [],
      slices,
      sliceStatus,
    };
    writeJson(dest, card);
    done += 1;
    if (done % 50 === 0 || done === ids.length) {
      console.log(`cards ${done}/${ids.length} errors=${errors}`);
    }
  });
  summary.cards = { requested: ids.length, written: done, errors };
}

function safeFileName(name) {
  return String(name || "file").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120);
}

async function dumpFiles(summary) {
  const filesDir = path.join(OUT_DIR, "files");
  fs.mkdirSync(path.join(filesDir, "lab"), { recursive: true });
  fs.mkdirSync(path.join(filesDir, "archive-pdf"), { recursive: true });

  const labResultsAll = readBulk("bulk/lab-results.json");
  const labResults = LIMIT > 0 ? labResultsAll.slice(0, LIMIT) : labResultsAll;
  let labOk = 0;
  let labSkip = 0;
  let labFail = 0;
  await mapPool(labResults, Math.min(4, CONCURRENCY), async (row) => {
    const name = `${row.id}_${safeFileName(row.fileName || "result")}`;
    const dest = path.join(filesDir, "lab", name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      labSkip += 1;
      return;
    }
    const src = row.filePath || "";
    const urls = [];
    if (src) {
      urls.push(/^https?:\/\//i.test(src) ? src : CLINIC_BASE + (src.startsWith("/") ? src : `/${src}`));
    }
    if (row.id != null) {
      urls.push(`${CLINIC_BASE}/api/LabResult/${row.id}`);
    }
    let saved = false;
    for (const url of urls) {
      try {
        const r = await requestRetry(url, {
          headers: { Accept: "application/octet-stream, application/pdf, */*" },
        });
        const ct = String(r.headers["content-type"] || "");
        const looksBinary =
          r.body.length > 64 &&
          !ct.includes("json") &&
          !ct.includes("text/html") &&
          r.body[0] !== 0x7b;
        if (r.status >= 200 && r.status < 300 && looksBinary) {
          fs.writeFileSync(dest, r.body);
          labOk += 1;
          saved = true;
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (!saved) labFail += 1;
  });

  let pdfOk = 0;
  const cardsDir = path.join(OUT_DIR, "cards");
  if (fs.existsSync(cardsDir)) {
    const cardFiles = fs.readdirSync(cardsDir).filter((f) => f.endsWith(".json"));
    await mapPool(cardFiles, Math.min(4, CONCURRENCY), async (file) => {
      const card = JSON.parse(fs.readFileSync(path.join(cardsDir, file), "utf8"));
      const list = Array.isArray(card.slices?.archivePdfs) ? card.slices.archivePdfs : [];
      for (const pdf of list) {
        const pdfId = pdf.id || pdf.pdfId;
        if (!pdfId) continue;
        const dest = path.join(filesDir, "archive-pdf", `${card.patientId}_${pdfId}.pdf`);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
        const url = `${CLINIC_BASE}/api/Archive/patient/pdf/${pdfId}`;
        try {
          const r = await requestRetry(url);
          if (r.status >= 200 && r.status < 300 && r.body.length) {
            fs.writeFileSync(dest, r.body);
            pdfOk += 1;
          }
        } catch {
          /* keep going */
        }
      }
    });
  }

  summary.files = { labDownloaded: labOk, labSkipped: labSkip, labFailed: labFail, archivePdfs: pdfOk };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = {
    sourceUi: "https://nafta-admin.webonly.io/en/dashboard/clinic/patients",
    sourceApi: CLINIC_BASE,
    fetchedAt: new Date().toISOString(),
    outDir: OUT_DIR,
    withFiles: WITH_FILES,
    bulk: {},
  };

  console.log(`out ${OUT_DIR}`);
  if (!SKIP_BULK) {
    await dumpBulk(summary);
    const swagger = await requestRetry(`${CLINIC_BASE}/swagger/v1/swagger.json`);
    if (swagger.status === 200) {
      writeJson(path.join(OUT_DIR, "catalogs/swagger.json"), JSON.parse(swagger.body.toString("utf8")));
    }
  }

  const patients = readBulk("bulk/patients.json");
  const archive = readBulk("bulk/archive.json");
  let ids = collectPatientIds(patients, archive);
  if (LIMIT > 0) ids = ids.slice(0, LIMIT);
  summary.patientIds = ids.length;
  writeJson(path.join(OUT_DIR, "bulk/patient-ids.json"), { count: ids.length, ids });

  if (!SKIP_CARDS) {
    await dumpCards(ids, summary);
  }
  if (WITH_FILES) {
    await dumpFiles(summary);
  }

  writeJson(path.join(OUT_DIR, "summary.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
