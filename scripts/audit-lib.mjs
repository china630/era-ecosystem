/**
 * Shared utilities for ERA integration audit scripts.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)));
export const ROOT = join(SCRIPTS_DIR, "..");

export const WALK_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "generated",
  ".next",
  "coverage",
]);

export const WALK_SKIP_FILE = /\.(spec|test)\.(ts|tsx|js|mjs)$/;

/** @param {string} p */
export function relPath(p) {
  return p.replace(ROOT, "").replace(/\\/g, "/").replace(/^\//, "");
}

/** @param {string} dir @param {string[]} [acc] @param {{ extensions?: RegExp, skipTestFiles?: boolean }} [opts] */
export function walkRepo(dir, acc = [], opts = {}) {
  const extensions = opts.extensions ?? /\.(ts|tsx|prisma|js|mjs)$/;
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (WALK_SKIP_DIRS.has(name)) continue;
    const st = statSync(p);
    if (st.isDirectory()) {
      walkRepo(p, acc, opts);
    } else if (extensions.test(name)) {
      if (opts.skipTestFiles !== false && WALK_SKIP_FILE.test(name)) continue;
      acc.push(p);
    }
  }
  return acc;
}

/** @returns {string[]} */
export function listEraApps() {
  return readdirSync(ROOT).filter(
    (n) => n.startsWith("era-") && statSync(join(ROOT, n)).isDirectory(),
  );
}

/** @param {string} app */
export function readPrismaSchema(app) {
  const path = join(ROOT, app, "prisma", "schema.prisma");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

/** @param {string | null} schema @param {string} modelName */
export function modelFields(schema, modelName) {
  if (!schema) return [];
  const re = new RegExp(`model\\s+${modelName}\\s*\\{([^}]+)\\}`, "s");
  const m = schema.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/^\s*(\w+)\s+/gm)].map((x) => x[1]);
}

/**
 * @param {{ code: string, app: string, message: string, file?: string, line?: number, domain?: string }} partial
 */
export function createIssue(partial) {
  return {
    domain: "DATA_MODEL",
    ...partial,
  };
}

/** @param {{ code: string, app?: string, file?: string }} issue */
export function issueKey(issue) {
  if (issue.file) return `${issue.code}:${issue.file}`;
  return `${issue.code}:${issue.app ?? "*"}`;
}

/** @param {string} app @param {string[]} tsFiles */
export function scanHubBoundary(app, tsFiles) {
  const text = tsFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  return {
    dataHubDirect:
      text.includes("/registry/v1") ||
      text.includes("ERA_DATA_HUB_URL") ||
      text.includes("DATA_HUB_SERVICE_TOKEN"),
    financeCatalogHandoff: scanFinanceCatalogHandoff(tsFiles),
    usesPlatformCatalog:
      text.includes("platform-catalog") ||
      text.includes("platformCatalogGet") ||
      text.includes("fetchPlatformCatalog") ||
      text.includes("getCalendarDay") ||
      text.includes("@era/satellite-kit"),
  };
}

/** @param {string[]} tsFiles */
export function scanFinanceCatalogHandoff(tsFiles) {
  const norm = (p) => p.replace(/\\/g, "/");
  const catalogRoutes = tsFiles.filter((f) =>
    /\/(fx-preview|voen-preview)\/route\.tsx?$/.test(norm(f)),
  );
  const routeText = catalogRoutes.map((f) => readFileSync(f, "utf8")).join("\n");
  if (
    routeText.includes("financeApiBaseUrl") ||
    routeText.includes("/api/logistics/fx-preview") ||
    (routeText.includes("/api/counterparties/voen-preview") &&
      routeText.includes("fetch(")) ||
    (routeText.includes("fetch(") &&
      (routeText.includes("ERA_FINANCE_API") || routeText.includes("FINANCE_API_URL")))
  ) {
    return true;
  }
  const calendarLibs = tsFiles.filter((f) => /production-calendar\.ts$/.test(norm(f)));
  const calText = calendarLibs.map((f) => readFileSync(f, "utf8")).join("\n");
  return calText.includes("/registry/v1") || calText.includes("ERA_DATA_HUB_URL");
}

/** Plan D: CP workforce tables must not store plaintext FIN/name. */
export function scanWorkforcePiiLeak(schema) {
  if (!schema) return false;
  const forbidden =
    /\b(finCode|firstName|lastName|passportNumber|fin_code|first_name|last_name|passport_number)\b/i;
  const blocks = [...schema.matchAll(/model\s+(Workforce\w+)\s*\{([^}]+)\}/gs)];
  return blocks.some(([, name, body]) => {
    if (!/^Workforce(Employment|Absence)/.test(name)) return false;
    return forbidden.test(body);
  });
}

/** @param {string} schema @param {string} modelName */
export function staffModelHasForbiddenIdentifiers(schema, modelName) {
  if (!schema) return false;
  const fields = modelFields(schema, modelName);
  const forbidden = ["finCode", "passportNumber", "nationalIdFin", "fin_code", "passport_number"];
  return forbidden.some((f) => fields.includes(f));
}

/** @param {string} app @param {string[]} tsFiles @param {string} allText */
export function scanWorkforceDualPath(app, tsFiles, allText) {
  if (app !== "era-clinic") return false;
  if (/finance_hr|local_master|WORKFORCE_HIRE_VIA_FINANCE|isFinanceHrHireMode/.test(allText)) {
    return true;
  }
  const norm = (p) => p.replace(/\\/g, "/");
  const postRoute = tsFiles.find((f) => /\/admin\/practitioners\/route\.ts$/.test(norm(f)));
  if (!postRoute) return true;
  const text = readFileSync(postRoute, "utf8");
  if (text.includes("createPractitionerLocalMaster")) return true;
  return !(
    text.includes("WORKFORCE_HIRE_VIA_CP") ||
    text.includes("isCpWorkforceHireModeActive") ||
    text.includes("fetchWorkforcePolicy")
  );
}

/** Finance must not publish STAFF_PROVISIONED on employee create (v3 CP publisher). */
export function scanWorkforceV3Publisher(employeesServiceText) {
  if (!employeesServiceText) return false;
  return (
    employeesServiceText.includes("emitProvisioned") ||
    employeesServiceText.includes("staffProvisioning.emit")
  );
}

/** @param {string | null} schema */
export function schemaHasPlaintextPii(schema) {
  if (!schema) return false;
  return (
    /\b(finCode|nationalIdFin|passportNumber)\s/.test(schema) &&
    !schema.includes("finCodeCipher") &&
    !schema.includes("passportNumberCipher")
  );
}

/** @param {string | null} schema */
export function guestHasIdentityColumns(schema) {
  if (!schema) return false;
  return schema.includes("nationalIdFin") || /\bpassportNumber\s/.test(schema);
}

/** @param {string} kitRoot */
export function scanSatelliteKitHubDrift(kitRoot) {
  const calendarPath = join(kitRoot, "src/integration/calendar.client.ts");
  if (!existsSync(calendarPath)) return false;
  const text = readFileSync(calendarPath, "utf8");
  return text.includes("/registry/v1") || text.includes("ERA_DATA_HUB_URL");
}
