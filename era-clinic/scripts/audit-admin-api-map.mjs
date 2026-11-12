/**
 * Inventory: every Nest admin handler that calls assertClinicAdmin*
 * must match ADMIN_API_PREFIX_PERMISSIONS (or allowlisted exceptions).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clinicRoot = path.resolve(__dirname, "..");
const generatedRoot = path.join(clinicRoot, "nest", "generated");
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

function walkRoutes(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("admin_") && name.endsWith(".ts"))
    .map((name) => path.join(dir, name));
}

/** `admin_wards__id_beds.ts` → `/api/admin/wards/x/beds`. */
function routeToApiPath(abs) {
  const chunks = path.basename(abs, ".ts").split("__");
  const segs = chunks[0].split("_").slice(1);
  for (const chunk of chunks.slice(1)) {
    const parts = chunk.split("_");
    segs.push("x", ...parts.slice(1));
  }
  const rel = segs.join("/");
  return { rel, apiPath: `/api/admin/${rel}`, top: segs[0] };
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

const routes = walkRoutes(generatedRoot);
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
