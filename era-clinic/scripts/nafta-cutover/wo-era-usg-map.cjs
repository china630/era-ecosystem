"use strict";

/** WO Müayinə Anketi diagnosisName → ERA DiagnosticService.code. */

const TITLES = {
  "USG-ABD": {
    en: "Abdominal + pelvic ultrasound (Nafta)",
    ru: "УЗИ живота и малого таза (Nafta)",
    az: "Qarın boşluğu və kiçik çanaq USM",
  },
  "USG-THYROID": { en: "Thyroid ultrasound", ru: "УЗИ щитовидной железы", az: "Qalxanabənzər vəzi USM" },
  "USG-BREAST": { en: "Breast ultrasound", ru: "УЗИ молочных желёз", az: "Süd vəziləri USM" },
  "USG-DOPPLER": { en: "Vascular Doppler ultrasound", ru: "УЗИ сосудов (доплер)", az: "Damər Doppler USM" },
  "USG-SOFT": { en: "Soft tissue ultrasound", ru: "УЗИ мягких тканей", az: "Yumşaq toxuma USM" },
};

function fold(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c");
}

function diagnosisName(form) {
  const diagnoses = Array.isArray(form?.diagnoses) ? form.diagnoses : [];
  return diagnoses.map((d) => String(d?.diagnosisName || d?.name || "")).join(" ");
}

function mapWoUsgServiceCode(form) {
  const name = diagnosisName(form);
  const n = fold(name);
  const nRaw = String(name).toLowerCase();
  const compact = n.replace(/[^a-z0-9]+/g, "");
  if (!n.trim() && !nRaw.trim()) return null;
  if (/sud\s*vez|breast|mammar/.test(n) || /молоч/.test(nRaw)) return "USG-BREAST";
  if (/tiroid|qalxanabenz|shitovid/.test(n) || /щитовид/.test(nRaw)) return "USG-THYROID";
  if (/dopler|doppler/.test(n) || /доплер/.test(nRaw)) return "USG-DOPPLER";
  if (/sethi|yumsaq\s*toxuma/.test(n) || /мягк/.test(nRaw)) return "USG-SOFT";
  if (/usm|usg|usi|ultrason|abdomen|qaraciyer/.test(n) || compact === "usm" || compact === "usg" || /узи|живот/.test(nRaw)) {
    return "USG-ABD";
  }
  return null;
}

function woUsgServiceTitle(code) {
  return TITLES[code] || { en: code, ru: code, az: code };
}

module.exports = { mapWoUsgServiceCode, woUsgServiceTitle, TITLES };
