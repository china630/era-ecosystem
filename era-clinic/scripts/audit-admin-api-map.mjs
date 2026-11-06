/**
 * Inventory: every app/api/admin route.ts that calls assertClinicAdmin*
 * must match ADMIN_API_PREFIX_PERMISSIONS (or allowlisted exceptions).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clinicRoot = path.resolve(__dirname, "..");
const adminApiRoot = path.join(clinicRoot, "app", "api", "admin");
const permissionsFile = path.join(
  clinicRoot,
  "src",
  "lib",
  "auth",
  "clinic-permissions.ts",
);

/** Handlers that intentionally skip assertClinicAdminRoute (platform SA gate inside). */
const SA_ONLY_ALLOWLIST = new Set([
  "schedule-recalc",
  "schedule-reseat",
  "ops-wipe",
]);

/**
 * Mapped outside ADMIN_API_PREFIX_PERMISSIONS (sharedApiPermission / special cases).
 */
const SPECIAL_MAPPED = new Set(["hotel-revenue-codes"]);

function walkRoutes(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkRoutes(p, acc);
    else if (ent.name === "route.ts") acc.push(p);
  }
  return acc;
}

function routeToApiPath(abs) {
  const rel = path
    .relative(adminApiRoot, abs)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");
  const normalized = rel
    .split("/")
    .map((seg) => (seg.startsWith("[") && seg.endsWith("]") ? "x" : seg))
    .join("/");
  return { rel, apiPath: `/api/admin/${normalized}`, top: rel.split("/")[0] };
}

const src = fs.readFileSync(permissionsFile, "utf8");
const prefixes = [...src.matchAll(/prefix:\s*"([^"]+)"/g)]
  .map((m) => m[1])
  .filter(
    (p) =>
      p.startsWith("/api/admin") ||
      p.startsWith("/api/import") ||
      p.startsWith("/api/catalog"),
  );

function isMapped(apiPath, top) {
  if (SPECIAL_MAPPED.has(top)) return true;
  return prefixes.some((p) => apiPath === p || apiPath.startsWith(`${p}/`));
}

const routes = walkRoutes(adminApiRoot);
const gaps = [];
const saOnly = [];
const other = [];

for (const abs of routes) {
  const { rel, apiPath, top } = routeToApiPath(abs);
  const body = fs.readFileSync(abs, "utf8");
  const usesAssert = /assertClinicAdmin(Route|Read|Write)/.test(body);
  const usesSa = /isPlatformSuperAdminUser/.test(body);

  if (SA_ONLY_ALLOWLIST.has(top)) {
    saOnly.push(apiPath);
    continue;
  }

  if (!usesAssert) {
    if (usesSa) saOnly.push(apiPath);
    else other.push({ apiPath, note: "no assertClinicAdmin*" });
    continue;
  }

  if (!isMapped(apiPath, top)) {
    gaps.push(apiPath);
  }
}

if (gaps.length) {
  console.error("UNMAPPED assertClinicAdmin routes:");
  for (const g of gaps) console.error(`  ${g}`);
  process.exitCode = 1;
} else {
  console.log(
    `OK: ${routes.length} admin routes checked; 0 unmapped assertClinicAdmin gaps`,
  );
  if (saOnly.length) {
    console.log(`SA-only / allowlisted (${saOnly.length}): ${saOnly.join(", ")}`);
  }
  if (other.length) {
    console.log("Other (no assertClinicAdmin*):");
    for (const o of other) console.log(`  ${o.apiPath} — ${o.note}`);
  }
}
