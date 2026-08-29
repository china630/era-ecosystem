import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

/**
 * Decide which GHCR images to rebuild from a changed-file list.
 *
 * Usage:
 *   node scripts/ci-changed-ghcr-services.mjs --json -- files...
 *   node scripts/ci-changed-ghcr-services.mjs --dispatch-services orchestrator,clinic
 *   node scripts/ci-changed-ghcr-services.mjs --all
 *
 * stdout: JSON plan { skip, rebuildPackages, services, servicesCsv, deployScope, deployServices, matrix }
 */
export const GHCR_MATRIX = [
  { service: "orchestrator", dockerfile: "era-orchestrator/Dockerfile", satellite_dir: "", satellite_port: "" },
  { service: "data-hub", dockerfile: "era-data-hub/Dockerfile", satellite_dir: "", satellite_port: "" },
  { service: "finance-core", dockerfile: "era-finance-core/Dockerfile", satellite_dir: "", satellite_port: "" },
  { service: "finance-web", dockerfile: "era-finance-core/Dockerfile.web", satellite_dir: "", satellite_port: "" },
  { service: "hotel-pms", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-hotel-pms", satellite_port: "3201" },
  { service: "fnb-pos", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-fnb-pos", satellite_port: "3202" },
  { service: "clinic", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-clinic", satellite_port: "3203" },
  { service: "retail-pos", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-retail-pos", satellite_port: "3204" },
  { service: "logistics", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-logistics", satellite_port: "3205" },
  { service: "construction", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-construction", satellite_port: "3206" },
  { service: "crm", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-crm", satellite_port: "3207" },
  { service: "auto-service", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-auto-service", satellite_port: "3208" },
  { service: "wholesale", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-wholesale", satellite_port: "3209" },
  { service: "bank-core", dockerfile: "era-bank-core/Dockerfile", satellite_dir: "", satellite_port: "" },
  { service: "bank", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-bank", satellite_port: "3210" },
  { service: "bank-dbo", dockerfile: "docker/Dockerfile.satellite", satellite_dir: "era-bank-dbo", satellite_port: "3211" },
];

const ALL_SERVICES = GHCR_MATRIX.map((row) => row.service);

const DIR_TO_SERVICE = {
  "era-orchestrator": "orchestrator",
  "era-data-hub": "data-hub",
  "era-hotel-pms": "hotel-pms",
  "era-fnb-pos": "fnb-pos",
  "era-clinic": "clinic",
  "era-retail-pos": "retail-pos",
  "era-logistics": "logistics",
  "era-construction": "construction",
  "era-crm": "crm",
  "era-auto-service": "auto-service",
  "era-wholesale": "wholesale",
  "era-bank-core": "bank-core",
  "era-bank": "bank",
  "era-bank-dbo": "bank-dbo",
};

function normalize(file) {
  return String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function isForceAll(file) {
  if (file.startsWith("packages/")) return true;
  if (file === "docker/Dockerfile.packages") return true;
  if (file === "docker/Dockerfile.satellite") return true;
  if (file === ".github/workflows/build-images.yml") return true;
  if (file === "scripts/ci-changed-ghcr-services.mjs") return true;
  return false;
}

function serviceForFile(file) {
  if (file.startsWith("era-finance-core/")) {
    if (
      file === "era-finance-core/Dockerfile.web" ||
      file.startsWith("era-finance-core/apps/web/")
    ) {
      return "finance-web";
    }
    return "finance-core";
  }
  const top = file.split("/")[0];
  return DIR_TO_SERVICE[top] || null;
}

function planFromServices(serviceSet, { rebuildPackages, all }) {
  const services = all ? [...ALL_SERVICES] : ALL_SERVICES.filter((s) => serviceSet.has(s));
  const skip = !all && services.length === 0;
  const matrix = skip ? [] : GHCR_MATRIX.filter((row) => services.includes(row.service));
  return {
    skip,
    rebuildPackages: Boolean(rebuildPackages || all),
    all: Boolean(all),
    services,
    servicesCsv: all ? "" : services.join(","),
    deployScope: skip ? "skip" : all ? "all" : "custom",
    deployServices: skip || all ? "" : services.join(" "),
    matrix,
  };
}

export function resolveGhcrPlan(files, { dispatchServices, forceAll } = {}) {
  if (forceAll) {
    return planFromServices(new Set(ALL_SERVICES), { rebuildPackages: true, all: true });
  }
  if (typeof dispatchServices === "string") {
    const trimmed = dispatchServices.trim();
    if (!trimmed) {
      return planFromServices(new Set(ALL_SERVICES), { rebuildPackages: true, all: true });
    }
    const wanted = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = wanted.filter((s) => !ALL_SERVICES.includes(s));
    if (unknown.length) {
      throw new Error(`Unknown GHCR services: ${unknown.join(", ")}`);
    }
    return planFromServices(new Set(wanted), { rebuildPackages: false, all: false });
  }

  const list = (files || []).map(normalize).filter(Boolean);
  if (list.some(isForceAll)) {
    return planFromServices(new Set(ALL_SERVICES), { rebuildPackages: true, all: true });
  }
  const serviceSet = new Set();
  for (const file of list) {
    const service = serviceForFile(file);
    if (service) serviceSet.add(service);
  }
  return planFromServices(serviceSet, { rebuildPackages: false, all: false });
}

function parseArgs(argv) {
  const files = [];
  let dispatchServices;
  let forceAll = false;
  let filesFrom;
  let dashDash = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (dashDash) {
      files.push(arg);
      continue;
    }
    if (arg === "--") {
      dashDash = true;
      continue;
    }
    if (arg === "--all") {
      forceAll = true;
      continue;
    }
    if (arg === "--json") {
      continue;
    }
    if (arg === "--files-from") {
      filesFrom = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--dispatch-services") {
      dispatchServices = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    files.push(arg);
  }
  if (filesFrom) {
    const raw = filesFrom === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(filesFrom, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (line.trim()) files.push(line.trim());
    }
  }
  return { files, dispatchServices, forceAll };
}

function main() {
  const { files, dispatchServices, forceAll } = parseArgs(process.argv.slice(2));
  const plan = resolveGhcrPlan(files, { dispatchServices, forceAll });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err.message || err}\n`);
    process.exit(1);
  }
}
