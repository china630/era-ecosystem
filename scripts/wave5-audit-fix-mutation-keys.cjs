/**
 * Wave 5 audit fix pass 2: correct domain write keys; never leave mutations on ledger.read.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../era-finance-core/apps/api/src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".controller.ts")) out.push(p);
  }
  return out;
}

function writeKeyForFile(rel) {
  const r = rel.replace(/\\/g, "/").toLowerCase();
  if (r.includes("procurement/") || r.includes("purchases/"))
    return "API_PURCHASES_MANAGE";
  if (r.includes("inventory/")) return "API_INVENTORY_APPROVE";
  if (r.includes("psa/")) return "API_PSA_MANAGE";
  if (r.includes("invoices/")) return "API_INVOICES_UPDATE";
  if (r.includes("team.controller") || r.includes("users.controller"))
    return "API_ORG_MEMBERS_WRITE";
  if (
    r.includes("organization-tenders") ||
    r.includes("organizations.controller")
  )
    return "ADMIN_ORG_SETTINGS";
  if (r.includes("admin-audit") || r.startsWith("admin/"))
    return "ADMIN_PLATFORM";
  if (r.includes("reporting/") || r.includes("reports/"))
    return "API_REPORTS_NAS";
  return "API_LEDGER_POST";
}

const MUTATION_DECOS = /@(Post|Put|Patch|Delete)\b/;

function isMutationStack(lines, i) {
  for (let j = Math.max(0, i - 15); j < i; j++) {
    if (MUTATION_DECOS.test(lines[j])) return true;
  }
  for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
    if (/^\s*(async\s+)?[a-zA-Z_]/.test(lines[j]) && !lines[j].includes("@"))
      break;
    if (MUTATION_DECOS.test(lines[j])) return true;
  }
  return false;
}

let fixed = 0;
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file);
  const writeKey = writeKeyForFile(rel);
  let src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("@Permissions(CP_PERMISSION.")) continue;
    if (!isMutationStack(lines, i)) continue;

    // Upgrade READ → domain write
    if (lines[i].includes("API_LEDGER_READ")) {
      lines[i] = lines[i].replace(
        "CP_PERMISSION.API_LEDGER_READ",
        `CP_PERMISSION.${writeKey}`,
      );
      changed = true;
      continue;
    }

    // Remap wrong generic POST to domain key
    if (
      writeKey !== "API_LEDGER_POST" &&
      lines[i].includes("API_LEDGER_POST")
    ) {
      lines[i] = lines[i].replace(
        "CP_PERMISSION.API_LEDGER_POST",
        `CP_PERMISSION.${writeKey}`,
      );
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join("\n"), "utf8");
    fixed++;
    console.log("fixed", rel, "→", writeKey);
  }
}
console.log("files", fixed);

// Spot-check remaining mutation+READ
let leftover = 0;
for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("API_LEDGER_READ") &&
      lines[i].includes("@Permissions") &&
      isMutationStack(lines, i)
    ) {
      leftover++;
      console.log(
        "LEFTOVER READ mutation",
        path.relative(SRC, file),
        "L" + (i + 1),
      );
    }
  }
}
console.log("leftover mutation READ", leftover);
