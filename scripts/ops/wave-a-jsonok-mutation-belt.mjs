/**
 * Wave A: rewrite success NextResponse.json / Response.json on mutation routes → jsonOk.
 * Conservative: skips returns that look like 4xx/5xx or `{ error: ... }` payloads.
 *
 * Usage: node scripts/ops/wave-a-jsonok-mutation-belt.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry-run");
const root = process.cwd();

const apps = [
  "era-hotel-pms/app/api",
  "era-fnb-pos/app/api",
  "era-clinic/app/api",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === "route.ts") out.push(p);
  }
  return out;
}

const MUT = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/;

/** Find balanced paren content starting after `openIdx` which points at `(`. */
function readBalanced(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { inner: src.slice(openIdx + 1, i), end: i };
    } else if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === q) break;
        i++;
      }
    }
  }
  return null;
}

function looksLikeErrorArgs(inner) {
  const compact = inner.replace(/\s+/g, " ");
  if (/status\s*:\s*[45]\d\d/.test(compact)) return true;
  // dynamic status (err.status) — never rewrite; may be 4xx
  if (/status\s*:\s*[^2\d]/.test(compact) && !/status\s*:\s*20\d/.test(compact)) {
    if (/status\s*:/.test(compact)) return true;
  }
  if (/status\s*:\s*err\./.test(compact)) return true;
  // second positional arg 4xx/5xx
  const m = compact.match(/,\s*([45]\d\d)\s*$/);
  if (m) return true;
  // positional non-literal status
  if (/,\s*[a-zA-Z_][\w.]*\s*$/.test(compact) && !/,\s*20\d\s*$/.test(compact)) {
    // e.g. `, denied` Response — skip
    if (/,\s*\w/.test(compact.split("{").slice(-1)[0] || "")) {
      /* fall through */
    }
  }
  // { error: ... } without explicit 2xx status → error path
  if (/\berror\s*:/.test(compact) && !/status\s*:\s*20\d/.test(compact)) {
    return true;
  }
  return false;
}

function extractStatus(inner) {
  const named = inner.match(/status\s*:\s*(20\d)\b/);
  if (named) return Number(named[1]);
  const pos = inner.match(/,\s*(20\d)\s*$/);
  if (pos) return Number(pos[1]);
  // Only default to 200 when there is no status key at all
  if (/status\s*:/.test(inner)) return null;
  return 200;
}

function stripStatusArg(inner) {
  // Remove `, { status: 20x }` or `, 20x`
  let s = inner.replace(/,\s*\{\s*status\s*:\s*20\d\s*\}\s*$/s, "");
  s = s.replace(/,\s*20\d\s*$/s, "");
  return s.trim();
}

function ensureJsonOkImport(text) {
  if (/\bjsonOk\b/.test(text) && /from\s+["']@\/lib\/api-utils["']/.test(text)) {
    // already imported somehow
    if (/import\s*\{[^}]*\bjsonOk\b[^}]*\}\s*from\s*["']@\/lib\/api-utils["']/.test(text)) {
      return text;
    }
  }
  // extend existing api-utils import
  const re =
    /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/api-utils["']\s*;/;
  const m = text.match(re);
  if (m) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.includes("jsonOk")) names.unshift("jsonOk");
    return text.replace(re, `import { ${names.join(", ")} } from "@/lib/api-utils";`);
  }
  // insert after first import
  const first = text.indexOf("import ");
  if (first < 0) {
    return `import { jsonOk } from "@/lib/api-utils";\n` + text;
  }
  return (
    text.slice(0, first) +
    `import { jsonOk } from "@/lib/api-utils";\n` +
    text.slice(first)
  );
}

function transformFile(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  if (!MUT.test(text)) return { changed: false, replacements: 0 };

  let replacements = 0;
  const patterns = ["NextResponse.json", "Response.json"];

  for (const label of patterns) {
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(label, searchFrom);
      if (idx < 0) break;
      // must be preceded by return (approx)
      const before = text.slice(Math.max(0, idx - 40), idx);
      if (!/return\s+$/.test(before) && !/return\s+\n\s*$/.test(before)) {
        // allow `return NextResponse.json` with newline
        const before2 = text.slice(Math.max(0, idx - 80), idx);
        if (!/return\s*$/s.test(before2.trimEnd()) && !/return\s+$/m.test(before2)) {
          searchFrom = idx + label.length;
          continue;
        }
      }
      const openIdx = text.indexOf("(", idx + label.length);
      if (openIdx < 0) break;
      const bal = readBalanced(text, openIdx);
      if (!bal) {
        searchFrom = idx + label.length;
        continue;
      }
      const { inner, end } = bal;
      if (looksLikeErrorArgs(inner)) {
        searchFrom = end + 1;
        continue;
      }
      const status = extractStatus(inner);
      if (status == null || status < 200 || status >= 400) {
        searchFrom = end + 1;
        continue;
      }
      const payload = stripStatusArg(inner);
      const replacement =
        status === 200
          ? `jsonOk(${payload})`
          : `jsonOk(${payload}, ${status})`;
      // include `return ` already before — replace from label through )
      text = text.slice(0, idx) + replacement + text.slice(end + 1);
      replacements++;
      searchFrom = idx + replacement.length;
    }
  }

  if (replacements === 0) return { changed: false, replacements: 0 };
  text = ensureJsonOkImport(text);
  // drop unused NextResponse import if no longer referenced
  if (!/NextResponse\./.test(text) && !/\bNextResponse\b/.test(text.replace(/import[^;]+NextResponse[^;]+;/, ""))) {
    text = text.replace(
      /import\s*\{\s*NextResponse\s*\}\s*from\s*["']next\/server["']\s*;\s*\n/,
      "",
    );
    text = text.replace(
      /import\s*\{\s*NextResponse\s*,\s*([^}]+)\}\s*from\s*["']next\/server["']\s*;/,
      'import { $1 } from "next/server";',
    );
    text = text.replace(
      /import\s*\{\s*([^}]+),\s*NextResponse\s*\}\s*from\s*["']next\/server["']\s*;/,
      'import { $1 } from "next/server";',
    );
  }
  if (!dry) fs.writeFileSync(filePath, text, "utf8");
  return { changed: true, replacements };
}

let totalFiles = 0;
let totalRepl = 0;
for (const rel of apps) {
  for (const file of walk(path.join(root, rel))) {
    const r = transformFile(file);
    if (r.changed) {
      totalFiles++;
      totalRepl += r.replacements;
      console.log(
        `${dry ? "DRY " : ""}${path.relative(root, file)} (+${r.replacements})`,
      );
    }
  }
}
console.log(
  `${dry ? "DRY-RUN " : ""}done: ${totalFiles} files, ${totalRepl} replacements`,
);
