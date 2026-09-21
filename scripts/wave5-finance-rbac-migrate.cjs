/**
 * Wave 5: replace Finance @Roles / RolesGuard with @Permissions / PermissionsGuard.
 * Run: node scripts/wave5-finance-rbac-migrate.mjs
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(
  __dirname,
  "../era-finance-core/apps/api/src",
);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (entry.endsWith(".controller.ts")) out.push(p);
  }
  return out;
}

/** Folder / file heuristics → CP_PERMISSION constant name */
function domainKeyForFile(rel) {
  const r = rel.replace(/\\/g, "/").toLowerCase();
  if (r.includes("/procurement/") || r.includes("/purchases/"))
    return "API_PURCHASES_MANAGE";
  if (r.includes("/inventory/") || r.includes("/wms"))
    return "API_INVENTORY_APPROVE";
  if (r.includes("payroll") || r.includes("banking-gateway"))
    return "API_PAYROLL_MONEY";
  if (
    r.includes("/hr/") ||
    r.includes("employees") ||
    r.includes("timesheet") ||
    r.includes("absence") ||
    r.includes("emas") ||
    r.includes("vacation") ||
    r.includes("per-diem") ||
    r.includes("business-trip") ||
    r.includes("work-schedule") ||
    r.includes("active-list") ||
    r.includes("employee-document")
  )
    return "API_PAYROLL_HR_CARD";
  if (r.includes("mgmt-labor") || r.includes("accounting-book"))
    return "API_BOOK_MGMT";
  if (r.includes("/psa/")) return "API_PSA_MANAGE";
  if (
    r.includes("extra-fields") ||
    r.includes("organization-settings") ||
    r.includes("system-catalog") ||
    r.includes("money-accounts")
  )
    return "ADMIN_ORG_SETTINGS";
  if (r.includes("/admin/") || r.includes("admin.controller"))
    return "ADMIN_PLATFORM";
  if (r.includes("/auth/team") || r.includes("users.controller"))
    return "API_ORG_MEMBERS_WRITE";
  if (r.includes("holdings")) return "API_REPORTS_NAS";
  if (
    r.includes("/reporting/") ||
    r.includes("/reports/") ||
    r.includes("audit-hub") ||
    r.includes("statforms") ||
    r.includes("mhbs")
  )
    return "API_REPORTS_NAS";
  if (r.includes("/invoices/") || r.includes("invoice-"))
    return "API_INVOICES_UPDATE";
  if (
    r.includes("/accounting/") ||
    r.includes("/accounts/") ||
    r.includes("/banking/") ||
    r.includes("/kassa/") ||
    r.includes("/treasury/") ||
    r.includes("fixed-assets") ||
    r.includes("intangible") ||
    r.includes("vat-deposit") ||
    r.includes("subconto") ||
    r.includes("ledger-mapping") ||
    r.includes("manual-adjustment") ||
    r.includes("grant-receipt") ||
    r.includes("posting-roles") ||
    r.includes("opening-balances") ||
    r.includes("prepaid") ||
    r.includes("trade-credit") ||
    r.includes("counterparties") ||
    r.includes("contracts") ||
    r.includes("customs") ||
    r.includes("gov-budget") ||
    r.includes("manufacturing") ||
    r.includes("network") ||
    r.includes("tax/") ||
    r.includes("compliance") ||
    r.includes("approvals") ||
    r.includes("activity-stream") ||
    r.includes("saved-list") ||
    r.includes("products") ||
    r.includes("price-lists") ||
    r.includes("ocr") ||
    r.includes("excel-bulk") ||
    r.includes("integrations") ||
    r.includes("industry-handoffs") ||
    r.includes("cash-order") ||
    r.includes("notifications")
  )
    return "API_LEDGER_POST";
  return "API_LEDGER_READ";
}

function extractRoles(rolesBlock) {
  const roles = [];
  const re = /UserRole\.([A-Z_]+)/g;
  let m;
  while ((m = re.exec(rolesBlock))) roles.push(m[1]);
  return [...new Set(roles)].sort();
}

function keyForRoles(roles, domainKey, rel) {
  const set = new Set(roles);
  const r = rel.replace(/\\/g, "/").toLowerCase();

  // Owner-only billing / transfer
  if (roles.length === 1 && set.has("OWNER")) {
    if (r.includes("billing") || r.includes("subscription"))
      return "API_BILLING_MANAGE";
    if (r.includes("transfer") || r.includes("ownership"))
      return "API_ORG_TRANSFER_OWNERSHIP";
    return domainKey;
  }

  // OWNER + ADMIN only → org settings / period close / platform
  if (
    roles.length === 2 &&
    set.has("OWNER") &&
    set.has("ADMIN") &&
    !set.has("ACCOUNTANT")
  ) {
    if (r.includes("period") || r.includes("close"))
      return "API_LEDGER_PERIOD_CLOSE";
    if (r.includes("extra-fields") || r.includes("organization-settings"))
      return "ADMIN_ORG_SETTINGS";
    if (r.includes("accounting-book") && !r.includes("mgmt"))
      return "ADMIN_ORG_SETTINGS";
    if (domainKey === "API_BOOK_MGMT") return "API_BOOK_MGMT";
    if (domainKey === "ADMIN_PLATFORM") return "ADMIN_PLATFORM";
    return domainKey === "API_LEDGER_POST"
      ? "API_LEDGER_PERIOD_CLOSE"
      : domainKey;
  }

  // MGMT / director labor
  if (set.has("DIRECTOR") && (set.has("OWNER") || set.has("ADMIN"))) {
    if (r.includes("mgmt") || r.includes("labor") || r.includes("book"))
      return "API_BOOK_MGMT";
  }

  // HR without accountant money
  if (
    (set.has("HR_MANAGER") || set.has("HR_OFFICER")) &&
    !set.has("ACCOUNTANT") &&
    domainKey === "API_PAYROLL_HR_CARD"
  ) {
    return "API_PAYROLL_HR_CARD";
  }

  // Payroll money cluster
  if (
    r.includes("payroll") &&
    (set.has("ACCOUNTANT") || set.has("OWNER")) &&
    !set.has("HR_MANAGER")
  ) {
    return "API_PAYROLL_MONEY";
  }

  // Procurement
  if (set.has("PROCUREMENT") || domainKey === "API_PURCHASES_MANAGE") {
    return "API_PURCHASES_MANAGE";
  }

  // Warehouse
  if (set.has("WAREHOUSE_KEEPER") || domainKey === "API_INVENTORY_APPROVE") {
    if (r.includes("inventory") || r.includes("wms") || r.includes("warehouse"))
      return "API_INVENTORY_APPROVE";
  }

  // USER included → invoices create (USER has create, not update/post)
  if (set.has("USER")) {
    if (r.includes("invoice") || r.includes("manual-adjustment"))
      return "API_INVOICES_CREATE";
    return "API_REPORTS_NAS";
  }

  // Read-heavy reports with DIRECTOR
  if (
    domainKey === "API_REPORTS_NAS" ||
    (set.has("DIRECTOR") &&
      set.has("ACCOUNTANT") &&
      (r.includes("report") || r.includes("reporting")))
  ) {
    // mutate endpoints in reporting may still be OAA → ledger.post via domain
    if (
      roles.every((x) =>
        ["OWNER", "ADMIN", "ACCOUNTANT", "DIRECTOR", "AUDITOR", "PARTNER"].includes(
          x,
        ),
      ) &&
      !r.includes("close") &&
      (r.includes("report") || r.includes("audit-hub") || r.includes("holding"))
    ) {
      return "API_REPORTS_NAS";
    }
  }

  // Classic OAA → domain
  if (set.has("ACCOUNTANT") || set.has("ADMIN") || set.has("OWNER")) {
    return domainKey;
  }

  return domainKey;
}

function ensureImports(src, needCp, needPerm, needGuard) {
  let out = src;
  if (needCp && !out.includes("CP_PERMISSION")) {
    // Prefer @era/contracts
    if (out.includes('from "@era/contracts"')) {
      out = out.replace(
        /import\s*\{([^}]+)\}\s*from\s*"@era\/contracts";/,
        (m, inner) => {
          if (inner.includes("CP_PERMISSION")) return m;
          return `import {${inner.trim().replace(/,$/, "")}, CP_PERMISSION } from "@era/contracts";`;
        },
      );
    } else {
      out = out.replace(
        /(^import .+;\n)/m,
        `$1import { CP_PERMISSION } from "@era/contracts";\n`,
      );
    }
  }
  if (needPerm && !/Permissions\s*\}/.test(out) && !/Permissions,/.test(out) && !out.includes("Permissions }")) {
    const relDepth = (out.match(/from "(\.\.\/)+/g) || []).length;
    // Find a relative auth import to place near
    if (out.includes('from "../common/decorators/permissions.decorator"') ||
        out.includes("permissions.decorator")) {
      // ok
    } else {
      // compute relative path from file — handled per-file below
    }
  }
  return out;
}

function fixImportsForFile(file, content) {
  const relToSrc = path.relative(SRC, path.dirname(file)).split(path.sep);
  const up = relToSrc.length === 0 || relToSrc[0] === "" ? "." : relToSrc.map(() => "..").join("/");
  const permImport = `${up}/common/decorators/permissions.decorator`;
  const guardImport = `${up}/common/guards/permissions.guard`;

  let out = content;

  // Remove Roles / RolesGuard imports
  out = out.replace(
    /import\s*\{[^}]*\bRoles\b[^}]*\}\s*from\s*["'][^"']*roles\.decorator["'];\s*\n/g,
    "",
  );
  out = out.replace(
    /import\s*\{[^}]*\bRolesGuard\b[^}]*\}\s*from\s*["'][^"']*roles\.guard["'];\s*\n/g,
    "",
  );
  // Clean UserRole from @erafinance/database if unused after
  // (leave for now if still referenced)

  if (!out.includes("CP_PERMISSION")) {
    out = `import { CP_PERMISSION } from "@era/contracts";\n` + out;
  }

  if (!out.includes("permissions.decorator")) {
    out = out.replace(
      /import \{ CP_PERMISSION \} from "@era\/contracts";\n/,
      `import { CP_PERMISSION } from "@era/contracts";\nimport { Permissions } from "${permImport}";\n`,
    );
  } else if (!/\bPermissions\b/.test(out.match(/from ["'][^"']*permissions\.decorator["']/)?.[0] ? "Permissions" : "") && !out.includes("{ Permissions")) {
    out = out.replace(
      /import\s*\{([^}]+)\}\s*from\s*["']([^"']*permissions\.decorator)["'];/,
      (m, inner, from) => {
        if (inner.includes("Permissions")) return m;
        return `import { Permissions, ${inner.trim()} } from "${from}";`;
      },
    );
  }

  if (!out.includes("permissions.guard")) {
    out = out.replace(
      /import \{ Permissions \} from "([^"]+)";\n/,
      `import { Permissions } from "$1";\nimport { PermissionsGuard } from "${guardImport}";\n`,
    );
  }

  return out;
}

function transformFile(file) {
  const rel = path.relative(SRC, file);
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("@Roles") && !src.includes("RolesGuard")) return false;

  const domainKey = domainKeyForFile(rel);

  // Replace UseGuards(RolesGuard) patterns
  src = src.replace(/@UseGuards\(\s*RolesGuard\s*\)/g, "@UseGuards(PermissionsGuard)");
  src = src.replace(
    /@UseGuards\(\s*RolesGuard\s*,\s*PermissionsGuard\s*\)/g,
    "@UseGuards(PermissionsGuard)",
  );
  src = src.replace(
    /@UseGuards\(\s*PermissionsGuard\s*,\s*RolesGuard\s*\)/g,
    "@UseGuards(PermissionsGuard)",
  );
  src = src.replace(
    /@UseGuards\(([^)]*?)RolesGuard\s*,/g,
    "@UseGuards($1",
  );
  src = src.replace(
    /@UseGuards\(([^)]*?),\s*RolesGuard\s*\)/g,
    "@UseGuards($1)",
  );
  src = src.replace(
    /@UseGuards\(([^)]*?),\s*RolesGuard\s*,/g,
    "@UseGuards($1,",
  );

  // Replace @Roles(...) blocks
  src = src.replace(
    /@Roles\(([\s\S]*?)\)\s*\n/g,
    (match, inner) => {
      const roles = extractRoles(inner);
      const key = keyForRoles(roles, domainKey, rel);
      // Skip if already has @Permissions on previous lines — still replace Roles
      return `@Permissions(CP_PERMISSION.${key})\n`;
    },
  );

  // Remove duplicate @Permissions when both legacy string and new exist on same method
  // Convert legacy bare @Permissions("purchases.manage") to canonical
  src = src.replace(
    /@Permissions\(\s*["']purchases\.manage["']\s*\)/g,
    "@Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)",
  );
  src = src.replace(
    /@Permissions\(\s*["']([^"']+)["']\s*\)/g,
    (m, code) => {
      const map = {
        "purchases.manage": "API_PURCHASES_MANAGE",
        "accounting.post": "API_LEDGER_POST",
        "billing.manage": "API_BILLING_MANAGE",
        "hr.manage": "API_PAYROLL_HR_CARD",
        "inventory.manage": "API_INVENTORY_APPROVE",
        "reporting.view": "API_REPORTS_NAS",
        "psa.manage": "API_PSA_MANAGE",
        "admin.system": "ADMIN_PLATFORM",
      };
      if (map[code]) return `@Permissions(CP_PERMISSION.${map[code]})`;
      if (code.startsWith("api:") || code.startsWith("admin:") || code.startsWith("screen:")) {
        // leave string form
        return m;
      }
      return m;
    },
  );

  // Deduplicate consecutive identical @Permissions
  src = src.replace(
    /(@Permissions\(CP_PERMISSION\.[A-Z_]+\))\n\1\n/g,
    "$1\n",
  );

  src = fixImportsForFile(file, src);

  // Drop unused UserRole import if no longer referenced
  if (!/\bUserRole\b/.test(src.replace(/import\s*\{[^}]*UserRole[^}]*\}[^;]*;/, ""))) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*["']@erafinance\/database["'];/,
      (m, inner) => {
        const parts = inner
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s && s !== "UserRole");
        if (!parts.length) return "";
        return `import { ${parts.join(", ")} } from "@erafinance/database";`;
      },
    );
  }

  fs.writeFileSync(file, src, "utf8");
  return true;
}

const files = walk(SRC);
let n = 0;
for (const f of files) {
  if (transformFile(f)) {
    n++;
    console.log("updated", path.relative(SRC, f));
  }
}
console.log("done", n, "controllers");
