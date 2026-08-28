/**
 * WO nahiye → S matcher (cutover adapter). Driven by physio-zones-s.json.
 * Strips order-field tokens (incl. ELECTRODE_COUNT 4 lü / 2 li) then matches S.
 * Does not assign cabins; 2-pad vs 4-pad rooms are canon §9 / planner.
 *
 * Domain port (import + SatAdmin queue): era-clinic/src/domain/physio/nahiye-match.ts
 * Golden tests compare both — do not let them drift.
 */
"use strict";

function norm(s) {
  return String(s)
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ıIİi]/g, (ch) => {
      if (ch === "I" || ch === "İ") return "i";
      if (ch === "ı") return "i";
      return ch;
    })
    .toLocaleLowerCase("az")
    .replace(/[.,;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(s) {
  return norm(s)
    .replace(/ə/g, "e")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/-/g, " ")
    .replace(/[+/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function indexWhole(hay, needle) {
  if (!needle) return -1;
  let from = 0;
  while (from <= hay.length) {
    const i = hay.indexOf(needle, from);
    if (i < 0) return -1;
    const before = i === 0 || hay[i - 1] === " ";
    const after = i + needle.length === hay.length || hay[i + needle.length] === " ";
    if (before && after) return i;
    from = i + 1;
  }
  return -1;
}

function bucketOf(m) {
  if (m.chips.length && !m.residue) return "mapped";
  if (!m.chips.length && !m.residue && m.flags.length) return "flags-only";
  if (m.chips.length && m.residue) return "partial";
  if (!m.chips.length && m.residue) return "unknown";
  return "empty-text";
}

function skuHint(procedureName) {
  const n = fold(procedureName || "");
  if (!n) return "";
  if (/\b(trunda|turunda)\b/.test(n) || /\bburun\b/.test(n)) return "nose";
  if (/inqalyasiya/.test(n)) return "nose";
  if (/massaj 30|ufb|parafin.*butun|yod.brom|hidromasaj|bukme/.test(n)) return "whole";
  return "";
}

function stripWhole(rest, needle) {
  let i;
  while ((i = indexWhole(rest, needle)) >= 0) {
    rest = (rest.slice(0, i) + " " + rest.slice(i + needle.length)).replace(/\s+/g, " ").trim();
  }
  return rest;
}

function resolveButun(rest, chips, addChip, procedureName) {
  if (indexWhole(rest, "butun") < 0) return rest;
  if (chips.length) return stripWhole(rest, "butun");
  const hint = skuHint(procedureName);
  if (hint === "nose") {
    addChip("ZONE-FACE");
    return stripWhole(rest, "butun");
  }
  if (hint === "whole") {
    addChip("ZONE-FULL-BODY");
    return stripWhole(rest, "butun");
  }
  return rest;
}

function buildMatcher(cat) {
  const fields = cat.orderFieldsNotZones || [];
  const fieldPhrases = [];
  for (const f of fields) {
    for (const w of f.wo || []) {
      const n = fold(w);
      if (n) fieldPhrases.push({ n, code: f.code, raw: w });
    }
  }
  fieldPhrases.sort((a, b) => b.n.length - a.n.length);

  const aliases = [];
  for (const z of cat.zones || []) {
    for (const w of z.woAliases || []) {
      const n = fold(w);
      if (n) aliases.push({ n, code: z.code });
    }
  }
  aliases.sort((a, b) => b.n.length - a.n.length);

  const composites = (cat.compositeMaps || []).map((c) => ({
    n: fold(c.wo),
    chips: c.chips || [],
    flags: c.flags || [],
  }));

  const stop = (
    (cat.matchRules && cat.matchRules.stopWords) || [
      "nahiyesine",
      "nahiyesi",
      "nahiyyesi",
      "nahiye",
      "ve",
    ]
  )
    .map((s) => fold(s))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const implies = (cat.matchRules && cat.matchRules.applicationCutImplies) || {};

  function match(text, opts) {
    const original = fold(text);
    const chips = [];
    const flags = [];
    const addChip = (c) => {
      if (c && !chips.includes(c)) chips.push(c);
    };
    const addFlag = (c) => {
      if (c && !flags.includes(c)) flags.push(c);
    };

    const hit = composites.find((c) => c.n && c.n === original);
    if (hit) {
      hit.chips.forEach(addChip);
      hit.flags.forEach(addFlag);
      return { chips, flags, residue: "", via: "composite" };
    }

    let rest = original;
    for (const p of fieldPhrases) {
      if (!p.n) continue;
      let i = indexWhole(rest, p.n);
      if (i < 0) continue;
      addFlag(p.code);
      while (i >= 0) {
        rest = (rest.slice(0, i) + " " + rest.slice(i + p.n.length)).replace(/\s+/g, " ").trim();
        i = indexWhole(rest, p.n);
      }
      if (p.code === "BATH_SEQUENCE") {
        addChip("ZONE-SITZ");
        addChip("ZONE-FULL-BODY");
      }
      if (p.code === "APPLICATION_CUT") {
        if (/corab|noski/.test(p.n) && implies.SOCK) addChip(implies.SOCK);
        if (/elcek/.test(p.n) && implies.GLOVE) addChip(implies.GLOVE);
      }
    }
    rest = rest.replace(/\s+/g, " ").trim();

    let guard = 0;
    while (rest && guard++ < 20) {
      let found = null;
      for (const a of aliases) {
        if (!a.n || indexWhole(rest, a.n) < 0) continue;
        if (a.code === "ZONE-HEAD" && a.n === "bas" && /\bbarmaq/.test(rest)) continue;
        found = a;
        break;
      }
      if (!found) break;
      addChip(found.code);
      const i = indexWhole(rest, found.n);
      rest = (rest.slice(0, i) + " " + rest.slice(i + found.n.length)).replace(/\s+/g, " ").trim();
    }

    for (const s of stop) {
      let i;
      while ((i = indexWhole(rest, s)) >= 0) {
        rest = (rest.slice(0, i) + " " + rest.slice(i + s.length)).replace(/\s+/g, " ").trim();
      }
    }

    rest = resolveButun(rest, chips, addChip, opts && opts.procedureName);

    return { chips, flags, residue: rest, via: "greedy" };
  }

  return { match };
}

module.exports = { norm, fold, indexWhole, bucketOf, buildMatcher };
