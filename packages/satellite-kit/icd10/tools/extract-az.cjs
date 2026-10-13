#!/usr/bin/env node
"use strict";
/**
 * Extract Azerbaijani titles from the official XBT-10 book (AR Səhiyyə Nazirliyi, 2012,
 * I cild I + II hissə) via pdf-lines.py JSONL dumps.
 *
 * Titles are the Arial >=12.5pt spans; inclusion/exclusion notes (Times 11pt) are ignored.
 * Fourth-character subdivisions printed once per range ("... dördüncü rəqəmlər E10-E14 ...")
 * are applied as "<category>: <subdivision>", the same composition WHO uses in its own files.
 * Only codes present in WHO ICD-10 2019 are kept; nothing is invented.
 *
 * Usage: node extract-az.cjs <part1.jsonl> <part2.jsonl> [out.json]
 */
const fs = require("fs");
const path = require("path");

const SOURCES = path.join(__dirname, "..", "sources");
const [part1, part2, outArg] = process.argv.slice(2);
if (!part1 || !part2) {
  console.error("Usage: node extract-az.cjs <part1.jsonl> <part2.jsonl> [out.json]");
  process.exit(2);
}
const OUT = outArg || path.join(SOURCES, "az-xbt10", "xbt10-az-2012.json");

const who = new Map();
for (const l of fs.readFileSync(path.join(SOURCES, "who-2019", "icd102019syst_codes.txt"), "utf8").split("\n")) {
  if (!l) continue;
  const f = l.split(";");
  who.set(f[6], { code: f[6], level: Number(f[0]), chapter: f[3] });
}
const groupSet = new Set(
  fs.readFileSync(path.join(SOURCES, "who-2019", "icd102019syst_groups.txt"), "utf8")
    .split("\n").filter(Boolean).map((l) => l.split(";")).map((f) => `${f[0]}-${f[1]}`),
);
const CHAPTER_BY_RANGE = new Map(Object.entries({
  "01": "A00-B99", "02": "C00-D48", "03": "D50-D89", "04": "E00-E90", "05": "F00-F99", "06": "G00-G99",
  "07": "H00-H59", "08": "H60-H95", "09": "I00-I99", "10": "J00-J99", "11": "K00-K93", "12": "L00-L99",
  "13": "M00-M99", "14": "N00-N99", "15": "O00-O99", "16": "P00-P96", "17": "Q00-Q99", "18": "R00-R99",
  "19": "S00-T98", "20": "V01-Y98", "21": "Z00-Z99", "22": "U00-U85",
}).map(([k, v]) => [v, k]));

const BIG = 12.5;
const HEADING = 15.5;
const RANGE_RE = /([A-Z]\d\d)\s*[–-]\s*([A-Z]\d\d)/;
const ANNOUNCE_RE = /(dördüncü|dördrəqəmli|dörd rəqəmli|dördişarəli|dörd işarəli)/i;
const SUB_RE = /^\.\s*(\d)\s*[†*]?\s*(\S.*)$/;
const EMBED_RE = /(^|\s)([A-Z])\s?(\d\d(?:\.\d{1,2})?)(?:\.[–-])?\s*[†*+]?(?=\s|$)/g;

const clean = (s) =>
  s.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim()
    .replace(/^\.[–-]\s*/, "")
    .replace(/^[o•]\s+(?=[A-ZƏÜÖĞŞÇİ])/, "");
const joinWrap = (a, b) =>
  /[A-Za-zƏəÜüÖöĞğŞşÇçİı]-$/.test(a) && /^[a-zəüöğşçı]/.test(b) ? a.slice(0, -1) + b : `${a} ${b}`;

function joinSpans(spans) {
  let out = "";
  let prevX1 = null;
  for (const s of spans) {
    const gap = prevX1 == null ? 0 : s.x - prevX1;
    out += (prevX1 != null && gap > 1.5 && !/\s$/.test(out) && !/^\s/.test(s.t) ? " " : "") + s.t;
    prevX1 = s.x1 ?? s.x;
  }
  return out.replace(/\s+/g, " ").trim();
}

function splitByCodes(text) {
  const hits = [];
  for (const m of text.matchAll(EMBED_RE)) {
    const code = `${m[2]}${m[3]}`;
    if (!who.has(code)) continue;
    hits.push({ code, start: m.index + m[1].length, end: m.index + m[0].length });
  }
  if (!hits.length) return [{ code: null, text }];
  const segs = [];
  if (hits[0].start > 0) segs.push({ code: null, text: text.slice(0, hits[0].start).trim() });
  hits.forEach((h, k) => {
    segs.push({ code: h.code, text: text.slice(h.end, hits[k + 1]?.start ?? text.length).trim() });
  });
  return segs;
}

function rowsOf(file) {
  const rows = [];
  for (const raw of fs.readFileSync(file, "utf8").trim().split("\n")) {
    const l = JSON.parse(raw);
    const last = rows[rows.length - 1];
    if (last && last.p === l.p && Math.abs(last.y - l.y) < 2.5) last.s.push(...l.s);
    else rows.push({ p: l.p, y: l.y, s: [...l.s] });
  }
  for (const r of rows) r.s.sort((a, b) => a.x - b.x);
  return rows;
}

function extract(file) {
  const rows = rowsOf(file);
  const titles = new Map();
  const headings = [];
  const tables = [];
  const catOrder = new Map();
  let open = null;
  let headingBuf = [];
  let table = null;
  let order = 0;

  const close = () => {
    if (open && !titles.has(open.code)) {
      const t = clean(open.text);
      if (t) titles.set(open.code, t);
    }
    open = null;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const big = r.s.filter((s) => s.sz >= BIG);
    const small = r.s.filter((s) => s.sz < BIG && s.sz > 8.5);
    const maxSz = Math.max(...r.s.map((s) => s.sz));
    if (maxSz <= 8.5) continue;
    if (!big.length && /^\d+$/.test(r.s.map((s) => s.t).join("").trim())) continue;

    if (big.length) {
      const bigText = joinSpans(big);
      const segs = splitByCodes(bigText);
      if (segs.some((s) => s.code)) {
        for (const seg of segs) {
          if (!seg.code) {
            if (open && seg.text) open.text = open.text ? joinWrap(open.text.trimEnd(), seg.text) : seg.text;
            continue;
          }
          close();
          headingBuf = [];
          if (table) table.closed = true;
          open = { code: seg.code, text: seg.text };
          if (who.get(seg.code).level === 3) catOrder.set(seg.code, order++);
        }
        continue;
      }
      if (maxSz >= HEADING) {
        close();
        const rm = RANGE_RE.exec(bigText);
        if (rm && /^\(?\s*[A-Z]\d\d\s*[–-]\s*[A-Z]\d\d\s*\)?$/.test(bigText)) {
          headings.push({ range: `${rm[1]}-${rm[2]}`, title: clean(headingBuf.join(" ")) });
          headingBuf = [];
        } else {
          headingBuf.push(bigText);
        }
        continue;
      }
      if (open) {
        open.text = open.text ? joinWrap(open.text.trimEnd(), bigText) : bigText;
        continue;
      }
      continue;
    }

    close();
    const text = small.map((s) => s.t).join(" ").replace(/\s+/g, " ").trim();
    if (ANNOUNCE_RE.test(text) && !/ümumi/i.test(text) && !/\(\s*[A-Z]\d\d/.test(text.split(ANNOUNCE_RE)[0])) {
      let rm = RANGE_RE.exec(text);
      let single = null;
      if (!rm) {
        rm = RANGE_RE.exec((rows[i + 1]?.s ?? []).map((s) => s.t).join(""));
        if (!rm) single = /([A-Z]\d\d)/.exec(text)?.[1] ?? null;
      }
      if (rm || single) {
        table = { from: rm ? rm[1] : single, to: rm ? rm[2] : single, at: order, items: {} };
        tables.push(table);
      }
      continue;
    }
    const first = small[0];
    const sm = first && first.x >= 50 && first.x <= 135 ? SUB_RE.exec(text) : null;
    if (table && !table.closed && sm && !table.items[sm[1]]) {
      table.items[sm[1]] = clean(sm[2]);
      table.last = sm[1];
      continue;
    }
    if (table && !table.closed && table.last && small.every((s) => s.b) && first.x >= 70 && !/^\./.test(text)) {
      table.items[table.last] = clean(`${table.items[table.last]} ${text}`);
      continue;
    }
    if (table) table.last = null;
  }
  close();
  return { titles, headings, tables, catOrder };
}

const parts = [extract(part1), extract(part2)];
const codes = new Map();
for (const part of parts) for (const [c, t] of part.titles) if (!codes.has(c)) codes.set(c, t);

const ANY_CODE_RE = /\s([A-Z]\d\d\.\d{1,2})\s+(?=[A-ZƏÜÖĞŞÇİ])/;
for (const [c, t] of [...codes]) {
  const m = ANY_CODE_RE.exec(t);
  if (!m) continue;
  const head = clean(t.slice(0, m.index));
  const tail = clean(t.slice(m.index + m[0].length));
  if (head) codes.set(c, head);
  else codes.delete(c);
  if (who.has(m[1]) && !codes.has(m[1]) && tail) codes.set(m[1], tail);
}

const composed = new Set();
for (const part of parts) {
  for (const w of who.values()) {
    if (codes.has(w.code) || w.level !== 4) continue;
    const cat = w.code.slice(0, 3);
    const catTitle = codes.get(cat);
    if (!catTitle || !part.catOrder.has(cat)) continue;
    const pos = part.catOrder.get(cat);
    const digit = w.code.slice(4);
    const cands = part.tables.filter((t) => cat >= t.from && cat <= t.to && t.at <= pos && t.items[digit]);
    const t = cands[cands.length - 1];
    if (!t) continue;
    codes.set(w.code, `${catTitle}: ${t.items[digit]}`);
    composed.add(w.code);
  }
}

const blocks = {};
const chapters = {};
for (const part of parts) {
  for (const h of part.headings) {
    if (!h.title) continue;
    if (groupSet.has(h.range) && !blocks[h.range]) blocks[h.range] = h.title;
    const ch = CHAPTER_BY_RANGE.get(h.range);
    if (ch && !chapters[ch]) chapters[ch] = h.title;
  }
}

const sorted = Object.fromEntries([...codes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const result = {
  source: "XBT-10, I cild (I və II hissə), Azərbaycan Respublikası Səhiyyə Nazirliyi, 2012",
  stats: { codes: codes.size, composedFromSubdivisionTables: composed.size, blocks: Object.keys(blocks).length, chapters: Object.keys(chapters).length },
  chapters: Object.fromEntries(Object.entries(chapters).sort()),
  blocks: Object.fromEntries(Object.entries(blocks).sort()),
  codes: sorted,
  composed: [...composed].sort(),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`, "utf8");
console.log(JSON.stringify(result.stats), "->", OUT);
