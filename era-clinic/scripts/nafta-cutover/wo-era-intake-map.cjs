"use strict";

/** CJS mirror of src/lib/import/nafta-intake-map.ts for rebuild scripts. */

const PKG_NAFTA_INTAKE = "PKG-NAFTA-INTAKE";

const NAFTA_INTAKE_SLOT_CODES = ["VISIT-SANATORIUM-INTAKE", "GYN-OR-URO", "CARDIO-ECG", "USG-ABD"];

const TITLES = {
  "VISIT-SANATORIUM-INTAKE": {
    en: "Doctor intake",
    ru: "Приём врача",
    az: "Həkim qəbulu",
  },
  "GYN-OR-URO": {
    en: "Gynecologist / urologist exam",
    ru: "Осмотр гинеколога / уролога",
    az: "Ginekoloq/Uroloq müayinəsi",
  },
  "CARDIO-ECG": {
    en: "ECG and cardiologist exam",
    ru: "ЭКГ и осмотр кардиолога",
    az: "EKQ və kardioloqun müayinəsi",
  },
  "USG-ABD": {
    en: "Abdominal + pelvic ultrasound",
    ru: "УЗИ живота и малого таза",
    az: "Qarın boşluğu və kiçik çanaq tam USM",
  },
};

function fold(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c");
}

function isNaftaIntakeGroupName(name) {
  const n = fold(name);
  return /ilkin\s*diaqnostik/.test(n) || /initial\s*diagnostic/.test(n);
}

function mapWoIntakeProcedureName(procedureName) {
  const n = fold(procedureName);
  if (!n.trim()) return null;
  if (/bas\s*hekim|hekim\s*qebul|hekim\s*qabul/.test(n) && !/ginek|uroloq|nevropatol|kardioloq/.test(n)) {
    return "VISIT-SANATORIUM-INTAKE";
  }
  if (/ginek|uroloq/.test(n)) return "GYN-OR-URO";
  if (/ekq|ecg|kardioloq/.test(n)) return "CARDIO-ECG";
  if (/usm|usg|ultrason|qarin\s*bosl|ki[cç]ik\s*[cç]anaq/.test(n)) return "USG-ABD";
  return null;
}

function naftaIntakeSlotTitle(code) {
  return TITLES[code] || { en: code, ru: code, az: code };
}

module.exports = {
  PKG_NAFTA_INTAKE,
  NAFTA_INTAKE_SLOT_CODES,
  TITLES,
  isNaftaIntakeGroupName,
  mapWoIntakeProcedureName,
  naftaIntakeSlotTitle,
};
