/**
 * Lead study titles with family token (AZ/RU), same idea as USM Böyrəklər.
 * Does not change codes or field labels.
 * Run: node prisma/scripts/apply-catalog-title-lead.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const catalogPath = path.join(__dirname, "..", "seed-data", "diagnostic-lab-catalog.json");
const overlayPath = path.join(
  __dirname,
  "..",
  "seed-data",
  "nafta",
  "diagnostic-overlay.json",
);

/** Manual RU after token-lead (avoid «УЗИ УЗДГ», «КТ КТ-…»). */
const RU_OVERRIDE = {
  "USG-TRUS": "УЗИ простаты (ТРУЗИ)",
  "USG-BCA": "УЗИ БЦА (сонные/вертебральные)",
  "USG-VEIN-LL": "УЗИ вен нижних конечностей",
  "USG-FOLLIC": "УЗИ фолликулометрия",
  "USG-ELASTO": "УЗИ эластография печени",
  "XR-ABD": "Рентген обзор брюшной полости",
  "XR-FLUORO": "Рентген флюорография",
  "XR-OPG": "Рентген ортопантомограмма",
  "CT-ANGIO": "КТ ангиография",
  "CT-CORO": "КТ коронарография",
  "MRI-MRA": "МРТ ангиография",
};

/** @type {Record<string, { az: string, ru: string, stripAz: string[], stripRu: string[] }>} */
const LEAD = {
  USG: {
    az: "USM",
    ru: "УЗИ",
    stripAz: ["USM", "US"],
    stripRu: ["УЗДГ", "ТРУЗИ", "УЗИ"],
  },
  XR: {
    az: "Rentgen",
    ru: "Рентген",
    stripAz: ["rentgeni", "rentgen"],
    stripRu: ["рентгенография", "рентген", "Рентген"],
  },
  CT: {
    az: "KT",
    ru: "КТ",
    stripAz: ["KT"],
    stripRu: ["КТ-", "КТ"],
  },
  MRI: {
    az: "MRT",
    ru: "МРТ",
    stripAz: ["MRT", "MR"],
    stripRu: ["МРТ-", "МР-", "МРТ", "MR"],
  },
};

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTokens(text, tokens) {
  let t = String(text || "").trim();
  for (const tok of tokens) {
    const e = escapeRe(tok);
    t = t.replace(new RegExp(`(?:^|\\s)${e}(?=\\s|$|\\()`, "gi"), " ");
    t = t.replace(new RegExp(`^${e}\\s+`, "i"), "");
    t = t.replace(new RegExp(`\\s+${e}$`, "i"), "");
  }
  return t.replace(/\s+/g, " ").trim();
}

function leadTitle(text, token, strip) {
  const rest = stripTokens(text, strip);
  if (!rest) return token;
  if (rest.toUpperCase() === token.toUpperCase()) return token;
  return `${token} ${rest}`;
}

function applyTemplateTitle(family, title) {
  const spec = LEAD[family];
  if (!spec || !title) return title;
  return {
    ...title,
    az: leadTitle(title.az, spec.az, spec.stripAz),
    ru: leadTitle(title.ru, spec.ru, spec.stripRu),
  };
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
let n = 0;
for (const m of catalog.modalities || []) {
  if (!LEAD[m.code]) continue;
  for (const t of m.templates || []) {
    const before = `${t.title?.az}||${t.title?.ru}`;
    t.title = applyTemplateTitle(m.code, t.title);
    if (RU_OVERRIDE[t.code]) t.title.ru = RU_OVERRIDE[t.code];
    if (`${t.title.az}||${t.title.ru}` !== before) n += 1;
  }
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

const overlay = JSON.parse(fs.readFileSync(overlayPath, "utf8"));
let o = 0;
for (const p of overlay.servicePatches || []) {
  if (!String(p.code || "").startsWith("USG-") || !p.title) continue;
  const before = `${p.title.az}||${p.title.ru}`;
  p.title = applyTemplateTitle("USG", p.title);
  if (`${p.title.az}||${p.title.ru}` !== before) o += 1;
}
fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + "\n", "utf8");

console.log("[title-lead] catalog templates updated", n, "overlay", o);
