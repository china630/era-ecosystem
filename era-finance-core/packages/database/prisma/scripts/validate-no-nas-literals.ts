import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const API_SRC = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "apps",
  "api",
  "src",
);

const WHITELIST_SUFFIXES = [
  "common/cash-account-code.util.ts",
  "banking/banking.service.ts",
  "reporting/reporting.service.ts",
  "reports/financial-report.service.ts",
  "scripts/local-mock-seed.ts",
];

const EXCLUDE_DIR_PARTS = new Set([
  "accounting/posting",
  "scripts",
]);

const NAS_LITERAL_RE =
  /(?:accountCode|offsetAccountCode|debitAccountCode|creditAccountCode|ledgerAccountCode|inventoryAccountCode)\s*:\s*['"](\d{3}(?:\.\d+)?)['"]|(?:offset|bank)\s*===\s*['"](\d{3})['"]/g;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      const rel = relative(API_SRC, full).replace(/\\/g, "/");
      if (EXCLUDE_DIR_PARTS.has(rel)) continue;
      out.push(...(await walk(full)));
    } else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".spec.ts")) {
      out.push(full);
    }
  }
  return out;
}

function isWhitelisted(relPath: string): boolean {
  return WHITELIST_SUFFIXES.some((s) => relPath.endsWith(s));
}

async function main(): Promise<void> {
  const files = await walk(API_SRC);
  const violations: string[] = [];

  for (const file of files) {
    const rel = relative(API_SRC, file).replace(/\\/g, "/");
    if (isWhitelisted(rel)) continue;
    const text = await readFile(file, "utf-8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("PostingAccountResolver") || line.includes("resolveAccountCode")) {
        continue;
      }
      NAS_LITERAL_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = NAS_LITERAL_RE.exec(line)) !== null) {
        const code = m[1] ?? m[2];
        violations.push(`${rel}:${i + 1}: NAS literal "${code}"`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("validate:no-nas-literals failed:\n" + violations.join("\n"));
    process.exit(1);
  }
  console.log("validate:no-nas-literals: ok");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
