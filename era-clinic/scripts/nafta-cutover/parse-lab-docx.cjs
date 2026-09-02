"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { eraAnalyteCode, eraPanelCode } = require("./wo-era-lab-map.cjs");

function readZipEntry(buf, entryName) {
  let i = 0;
  const want = entryName.replace(/\\/g, "/");
  while (i < buf.length - 4) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
      const method = buf.readUInt16LE(i + 8);
      const comp = buf.readUInt32LE(i + 18);
      const nameLen = buf.readUInt16LE(i + 26);
      const extra = buf.readUInt16LE(i + 28);
      const name = buf.slice(i + 30, i + 30 + nameLen).toString("utf8").replace(/\\/g, "/");
      const start = i + 30 + nameLen + extra;
      const data = buf.slice(start, start + (comp || 0));
      if (name === want) {
        if (method === 0) return data;
        if (method === 8) return zlib.inflateRawSync(data);
        throw new Error(`zip method ${method} for ${name}`);
      }
      i = start + Math.max(comp, 0);
      continue;
    }
    i += 1;
  }
  return null;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function joinRuns(texts) {
  return texts.join("").replace(/\s+/g, " ").trim();
}

function extractParagraphs(xml) {
  const paras = [];
  const parts = xml.split(/<\/w:p>/);
  for (const part of parts) {
    const texts = [];
    const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tRe.exec(part))) texts.push(decodeXmlEntities(tm[1]));
    const line = joinRuns(texts);
    if (line) paras.push(line);
  }
  return paras;
}

function extractTableRows(xml) {
  const rows = [];
  const trChunks = xml.split(/<\/w:tr>/);
  for (const tr of trChunks) {
    if (!/<w:tc[\s>]/.test(tr)) continue;
    const cells = [];
    const tcChunks = tr.split(/<\/w:tc>/);
    for (const tc of tcChunks) {
      if (!/<w:tc[\s>]/.test(tc)) continue;
      const texts = [];
      const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tm;
      while ((tm = tRe.exec(tc))) texts.push(decodeXmlEntities(tm[1]));
      cells.push(joinRuns(texts));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function analyteCode(label) {
  const head = String(label || "")
    .split("(")[0]
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const aliased = eraAnalyteCode(head);
  if (aliased !== head) return aliased;
  const s = head
    .replace(/%/g, "PCT")
    .replace(/#/g, "ABS")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return eraAnalyteCode(s || "LINE").slice(0, 32);
}

function isHeaderRow(cells) {
  const blob = cells.join(" ").toLowerCase();
  return /parametr|nəticə|netice|norma|result/.test(blob);
}

function isIndexCell(s) {
  return /^\d+$/.test(String(s || "").trim());
}

function looksLikeDateValue(s) {
  return /\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*20\d{2}/.test(String(s || ""));
}

function isJunkResultLabel(lab) {
  const t = String(lab || "").trim();
  if (!t || t.length > 120) return true;
  if (/^\d+$/.test(t)) return true;
  if (/\btarix\b|\bdate\b/i.test(t)) return true;
  if (/fiziki[- ]?kimyəvi|mikroskopiya/i.test(t)) return true;
  if (/^(ad|soyad|yaş|yas|cins|patient|həkim|hekim|həkim laborant|parametr|nəticə|norma)/i.test(t)) {
    return true;
  }
  return false;
}

function parseValueUnit(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ");
  if (!s) return { value: "", unit: "" };
  const compact = s.replace(/\s/g, "");
  if (/^\d{1,2}[.\-/]\d{1,2}[.\-/]20\d{2}$/.test(compact)) {
    return { value: "", unit: "" };
  }
  if (/^\d+\s*-\s*\d+$/.test(s)) {
    return { value: s.replace(/\s/g, ""), unit: "" };
  }
  if (/^[+\-]+$/.test(s) || /^(yoxdur|neg|pos|n\/?a|—|–|-)$/i.test(s)) {
    return { value: s, unit: "" };
  }
  if (/^-?\d+[.,]\d+$/.test(compact)) {
    return { value: compact.replace(",", "."), unit: "" };
  }
  const withUnit = s.match(/^(-?\d+(?:[.,]\d+)?)\s+(\S.*)$/);
  if (withUnit && /[A-Za-zµμ%\/°^]/.test(withUnit[2])) {
    return { value: withUnit[1].replace(",", "."), unit: withUnit[2].trim() };
  }
  const numOnly = s.match(/^(-?\d+(?:[.,]\d+)?)$/);
  if (numOnly) return { value: numOnly[1].replace(",", "."), unit: "" };
  return { value: s, unit: "" };
}

function pushResult(out, seen, label, rawValue, refRange) {
  const lab = String(label || "").trim();
  if (isJunkResultLabel(lab)) return;
  if (looksLikeDateValue(lab) || looksLikeDateValue(rawValue)) return;
  const { value, unit } = parseValueUnit(rawValue);
  if (!value || /^norma$/i.test(value)) return;
  if (refRange && value === String(refRange).trim()) return;
  const code = analyteCode(lab);
  if (code === "U-DATE") return;
  let valueOut = value;
  if (code === "U-SG" && /^1\d{3}$/.test(valueOut)) {
    valueOut = `${valueOut[0]}.${valueOut.slice(1)}`;
  }
  const key = `${code}|${valueOut}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    code,
    label: lab,
    value: valueOut,
    unit,
    refRange: String(refRange || "").trim(),
  });
}

function ingestNumberedRows(tableRows, out, seen) {
  let started = false;
  let n = 0;
  for (const cells of tableRows) {
    if (isHeaderRow(cells)) continue;
    const first = String(cells[0] || "").trim();
    if (!started) {
      if (isIndexCell(first) && first === "1") started = true;
      else continue;
    }
    if (!isIndexCell(first)) continue;
    n += 1;
    if (cells.length >= 4) pushResult(out, seen, cells[1] || cells[0], cells[2], cells[3]);
    else if (cells.length === 3) pushResult(out, seen, cells[1], cells[2], "");
  }
  return n;
}

function ingestLegacyRows(tableRows, out, seen) {
  for (const cells of tableRows) {
    if (isHeaderRow(cells)) continue;
    if (cells.length >= 4) {
      pushResult(out, seen, cells[1] || cells[0], cells[2], cells[3]);
      continue;
    }
    if (cells.length === 3) {
      pushResult(out, seen, cells[0], cells[1], cells[2]);
      continue;
    }
    if (cells.length === 2) pushResult(out, seen, cells[0], cells[1], "");
  }
}

function resultsFromTableRows(tableRows) {
  const out = [];
  const seen = new Set();
  const numbered = ingestNumberedRows(tableRows, out, seen);
  if (numbered < 3) ingestLegacyRows(tableRows, out, seen);
  return out;
}

function splitLabelValue(line) {
  const m = String(line).match(/^(.*?)[:\t]+(.+)$/);
  if (m && looksNumeric(m[2].trim().split(/\s+/)[0])) {
    return { label: m[1].trim(), value: m[2].trim() };
  }
  const m2 = String(line).match(/^(.*?)[\s.]{2,}(.+)$/);
  if (m2 && looksNumeric(m2[2].trim().split(/\s+/)[0])) {
    return { label: m2[1].trim(), value: m2[2].trim() };
  }
  return null;
}

function looksNumeric(value) {
  const s = String(value || "").trim().replace(",", ".");
  if (!s || s.length > 24) return false;
  if (/^(n\/?a|neg|pos|-|—|–)$/i.test(s)) return true;
  return /^-?\d+(\.\d+)?(%|x10\^\d+)?$/i.test(s) || /^-?\d+\s*-\s*\d+/.test(s);
}

function resultsFromDocxBuffer(buf, fileName) {
  const { lines, tableRows } = linesFromDocxBuffer(buf);
  const out = resultsFromTableRows(tableRows);
  if (out.length < 3) {
    const seen = new Set(out.map((r) => `${r.code}|${r.value}`));
    for (const line of lines) {
      const pair = splitLabelValue(line);
      if (pair) pushResult(out, seen, pair.label, pair.value, "");
    }
  }
  return { panel: panelFromName(fileName), results: out, lineCount: lines.length, tableRowCount: tableRows.length };
}

function slugCode(label) {
  const s = String(label || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\u0400-\u04FF\u018F\u011E\u0130\u015E]+/g, "_")
    .replace(/^_|_$/g, "");
  return (s || "LINE").slice(0, 48);
}

function panelFromName(fileName) {
  const n = String(fileName || "").toUpperCase();
  if (/QAN|CBC|HEMOGRAM/.test(n)) return "QAN";
  if (/B[İI]OK|BIOCHEM/.test(n)) return "BIOKIM";
  if (/S[İI]D[İI]K|URINE/.test(n)) return "SIDIK";
  if (/DIMER|D-DIMER|D_DIMER/.test(n)) return "DIMER";
  if (/\bCRP\b/.test(n)) return "CRP";
  if (/\bPRL\b|PROLACTIN/.test(n)) return "PRL";
  if (/İNSULİN|INSULIN|\bINS\b|NSULIN/.test(n)) return "INSULIN";
  if (/HORMON/.test(n)) return "HORMON";
  return "OTHER";
}

function testCodeFromPanel(panel) {
  return eraPanelCode(panel);
}

function linesFromDocxBuffer(buf) {
  const xmlBuf = readZipEntry(buf, "word/document.xml");
  if (!xmlBuf) return { lines: [], tableRows: [] };
  const xml = xmlBuf.toString("utf8");
  return { lines: extractParagraphs(xml), tableRows: extractTableRows(xml) };
}

function parseLabDocxFile(absPath) {
  const buf = fs.readFileSync(absPath);
  if (buf.slice(0, 5).toString("ascii") === "%PDF-") {
    return { panel: panelFromName(path.basename(absPath)), results: [], skipped: "pdf" };
  }
  return resultsFromDocxBuffer(buf, path.basename(absPath));
}

module.exports = {
  panelFromName,
  testCodeFromPanel,
  parseLabDocxFile,
  resultsFromDocxBuffer,
  resultsFromTableRows,
  linesFromDocxBuffer,
  parseValueUnit,
  isJunkResultLabel,
  slugCode,
};

if (require.main === module) {
  const sample = process.argv[2];
  if (!sample) {
    console.error("usage: node parse-lab-docx.cjs <file.docx>");
    process.exit(1);
  }
  const parsed = parseLabDocxFile(sample);
  if (process.argv.includes("--debug")) {
    const buf = fs.readFileSync(sample);
    const inner = linesFromDocxBuffer(buf);
    console.log(JSON.stringify({ tableRows: inner.tableRows.slice(0, 8), lines: inner.lines.slice(0, 40) }, null, 2));
  } else {
    console.log(JSON.stringify(parsed, null, 2));
  }
}
