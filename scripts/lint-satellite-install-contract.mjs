#!/usr/bin/env node
/**
 * Lint satellite install contract:
 * 1) satellite .env.example — no ORCHESTRATOR_* :4100
 * 2) no =demo-org / demo-bank-org-001 / demo-clinic-org values
 * 3) docker-compose.prod.yml — no *_SERVICE_TOKEN under environment
 *
 * Config: config/satellite-install-contract.yaml
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "config", "satellite-install-contract.yaml");

function parseSimpleYaml(text) {
  // Minimal subset: version, lists of scalars, nested maps for ports only.
  // Prefer hand-maintained structure over adding a YAML dependency.
  const contract = {
    satellite_env_examples: [],
    forbidden_org_env_values: [],
    prod_overlay_forbidden_env_key_suffixes: [],
  };
  let listKey = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "");
    if (!line.trim()) continue;
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && listKey) {
      contract[listKey].push(listItem[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    const keyMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, rest] = keyMatch;
      listKey = null;
      if (
        key === "satellite_env_examples" ||
        key === "forbidden_org_env_values" ||
        key === "prod_overlay_forbidden_env_key_suffixes" ||
        key === "compose_contract_files"
      ) {
        listKey = key;
        contract[key] = contract[key] || [];
        continue;
      }
      if (rest && !rest.startsWith("|")) {
        contract[key] = rest.trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return contract;
}

const contract = parseSimpleYaml(fs.readFileSync(contractPath, "utf8"));
const violations = [];

const ORCH_KEYS = /^(ORCHESTRATOR_URL|ORCHESTRATOR_EVENT_URL|CONTROL_PLANE_URL)\s*=/;
const FORBIDDEN_ORGS = contract.forbidden_org_env_values?.length
  ? contract.forbidden_org_env_values
  : ["demo-org", "demo-clinic-org", "demo-bank-org-001"];

for (const rel of contract.satellite_env_examples || []) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    violations.push(`missing ${rel}`);
    continue;
  }
  const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    if (ORCH_KEYS.test(t) && /:4100\b/.test(t)) {
      violations.push(`${rel}:${i + 1}: orch key must not use finance port :4100 — ${t}`);
    }
    for (const bad of FORBIDDEN_ORGS) {
      if (new RegExp(`=\\s*${bad}\\s*$`).test(t) || t.endsWith(`=${bad}`)) {
        violations.push(`${rel}:${i + 1}: forbidden org value — ${t}`);
      }
    }
  });
}

const prod = path.join(root, "docker-compose.prod.yml");
const prodText = fs.readFileSync(prod, "utf8");
const prodLines = prodText.split(/\r?\n/);
let inEnvironment = false;
let envIndent = 0;
prodLines.forEach((line, i) => {
  const envMatch = line.match(/^(\s+)environment:\s*$/);
  if (envMatch) {
    inEnvironment = true;
    envIndent = envMatch[1].length;
    return;
  }
  if (inEnvironment) {
    const m = line.match(/^(\s*)(\S)/);
    if (!m) return;
    const ind = m[1].length;
    if (ind <= envIndent && !line.trim().startsWith("#")) {
      inEnvironment = false;
      return;
    }
    if (/^\s+[A-Z0-9_]+:/.test(line) && /_SERVICE_TOKEN:/.test(line)) {
      violations.push(
        `docker-compose.prod.yml:${i + 1}: *_SERVICE_TOKEN forbidden in prod overlay — ${line.trim()}`,
      );
    }
  }
});

// Keep YAML compose_contract_files in sync with path-filter INSTALL_CONTRACT_FILES.
try {
  const { INSTALL_CONTRACT_FILES } = await import("./ci-changed-ghcr-services.mjs");
  const fromYaml = new Set(contract.compose_contract_files || []);
  const fromCode = INSTALL_CONTRACT_FILES;
  for (const f of fromCode) {
    if (!fromYaml.has(f)) {
      violations.push(
        `compose_contract_files missing path-filter entry: ${f}`,
      );
    }
  }
  for (const f of fromYaml) {
    if (!fromCode.has(f)) {
      violations.push(
        `compose_contract_files extra (not in INSTALL_CONTRACT_FILES): ${f}`,
      );
    }
  }
} catch (err) {
  violations.push(
    `could not load INSTALL_CONTRACT_FILES: ${err instanceof Error ? err.message : err}`,
  );
}

if (violations.length) {
  console.error("FAIL: satellite install contract lint:\n");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}

console.log(
  `PASS: install contract lint (${(contract.satellite_env_examples || []).length} env examples + prod overlay + path-filter parity)`,
);
