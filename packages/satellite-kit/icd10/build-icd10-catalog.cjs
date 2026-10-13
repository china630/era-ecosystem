#!/usr/bin/env node
"use strict";
/**
 * Build data/icd10-catalog.json from the original sources in ./sources (see sources/SOURCES.md).
 *
 * Code list and hierarchy: WHO ICD-10 2019. Titles per language come only from that language's
 * source; a missing translation stays null (never filled from another language or generated).
 *
 * Usage: node build-icd10-catalog.cjs [--check]
 */
const fs = require("fs");
const path = require("path");

const ICD10_VERSION = "WHO-ICD-10-2019+RU-1005-2.27+AZ-XBT10-2012";
const SRC = path.join(__dirname, "sources");
const OUT = path.join(__dirname, "data", "icd10-catalog.json");

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV",
  "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII"];

const readLines = (rel) => fs.readFileSync(path.join(SRC, rel), "utf8").split("\n").filter(Boolean);

function parseCsvLine(line, sep = ";") {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function loadWho() {
  const chapters = readLines("who-2019/icd102019syst_chapters.txt").map((l) => {
    const [num, title] = l.split(";");
    return { num, title };
  });
  const groups = readLines("who-2019/icd102019syst_groups.txt").map((l) => {
    const [from, to, num, title] = l.split(";");
    return { from, to, num, title, code: `${from}-${to}` };
  });
  const codes = readLines("who-2019/icd102019syst_codes.txt").map((l) => {
    const f = l.split(";");
    return { level: Number(f[0]), chapterNum: f[3], blockFrom: f[4], code: f[6], title: f[8] };
  });
  return { chapters, groups, codes };
}

function loadRu() {
  const lines = readLines("ru-minzdrav/1.2.643.5.1.13.13.11.1005_2.27.csv");
  const header = parseCsvLine(lines[0]);
  const iCode = header.indexOf("MKB_CODE");
  const iName = header.indexOf("MKB_NAME");
  const iActual = header.indexOf("ACTUAL");
  const byCode = new Map();
  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line);
    const code = f[iCode]?.trim();
    const name = f[iName]?.trim();
    if (!code || !name) continue;
    const active = f[iActual] === "1";
    const prev = byCode.get(code);
    if (!prev || (active && !prev.active)) byCode.set(code, { name, active });
  }
  return byCode;
}

function loadAz() {
  const j = JSON.parse(fs.readFileSync(path.join(SRC, "az-xbt10", "xbt10-az-2012.json"), "utf8"));
  const chapters = {};
  for (const [num, t] of Object.entries(j.chapters)) {
    chapters[num] = t.replace(/^[IVXL]+\s+SİNİF\s+/u, "").trim();
  }
  return { codes: j.codes, blocks: j.blocks, chapters };
}

function buildCatalog() {
  const who = loadWho();
  const ru = loadRu();
  const az = loadAz();
  const ruTitle = (code) => ru.get(code)?.name ?? null;

  const blockByFrom = new Map(who.groups.map((g) => [g.from, g]));
  const chapterRange = new Map();
  for (const g of who.groups) {
    const r = chapterRange.get(g.num);
    chapterRange.set(g.num, r ? { from: r.from, to: g.to } : { from: g.from, to: g.to });
  }

  const rows = [];
  for (const ch of who.chapters) {
    const roman = ROMAN[Number(ch.num)];
    const range = chapterRange.get(ch.num);
    rows.push({
      code: roman,
      kind: "CHAPTER",
      chapterCode: roman,
      blockCode: `${range.from}-${range.to}`,
      parentCode: null,
      titleEn: ch.title,
      titleRu: ruTitle(roman),
      titleAz: az.chapters[ch.num] ?? null,
      selectable: false,
    });
  }
  for (const g of who.groups) {
    const roman = ROMAN[Number(g.num)];
    rows.push({
      code: g.code,
      kind: "BLOCK",
      chapterCode: roman,
      blockCode: g.code,
      parentCode: roman,
      titleEn: g.title,
      titleRu: ruTitle(g.code),
      titleAz: az.blocks[g.code] ?? null,
      selectable: false,
    });
  }
  for (const c of who.codes) {
    const block = blockByFrom.get(c.blockFrom);
    if (!block) throw new Error(`No WHO block for ${c.code} (${c.blockFrom})`);
    const parentCode = c.level === 3 ? block.code : c.level === 4 ? c.code.slice(0, 3) : c.code.slice(0, 5);
    rows.push({
      code: c.code,
      kind: c.level === 3 ? "CATEGORY" : "LEAF",
      chapterCode: ROMAN[Number(c.chapterNum)],
      blockCode: block.code,
      parentCode,
      titleEn: c.title,
      titleRu: ruTitle(c.code),
      titleAz: az.codes[c.code] ?? null,
      selectable: true,
    });
  }

  const codes = rows.filter((r) => r.kind === "CATEGORY" || r.kind === "LEAF");
  const coverage = {
    rows: rows.length,
    codes: codes.length,
    en: codes.filter((r) => r.titleEn).length,
    ru: codes.filter((r) => r.titleRu).length,
    az: codes.filter((r) => r.titleAz).length,
    blocksRu: rows.filter((r) => r.kind === "BLOCK" && r.titleRu).length,
    blocksAz: rows.filter((r) => r.kind === "BLOCK" && r.titleAz).length,
    chaptersRu: rows.filter((r) => r.kind === "CHAPTER" && r.titleRu).length,
    chaptersAz: rows.filter((r) => r.kind === "CHAPTER" && r.titleAz).length,
  };
  return { version: ICD10_VERSION, coverage, rows };
}

function serialize(catalog) {
  const head = JSON.stringify({ version: catalog.version, coverage: catalog.coverage });
  const body = catalog.rows.map((r) => JSON.stringify(r)).join(",\n");
  return `${head.slice(0, -1)},"rows":[\n${body}\n]}\n`;
}

if (require.main === module) {
  const text = serialize(buildCatalog());
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (current !== text) {
      console.error("data/icd10-catalog.json is stale — run: node packages/satellite-kit/icd10/build-icd10-catalog.cjs");
      process.exit(1);
    }
    console.log("icd10-catalog.json up to date");
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, text, "utf8");
    console.log("wrote", OUT, JSON.stringify(JSON.parse(text).coverage));
  }
}

module.exports = { ICD10_VERSION, buildCatalog, serialize };
