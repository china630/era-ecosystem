#!/usr/bin/env node
/**
 * Sync shared auth.* keys from i18n-common into satellite/orchestrator message files
 * and report EN key parity vs AZ reference.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const commonAz = JSON.parse(
  fs.readFileSync(path.join(root, "packages/i18n-common/messages/common.az.json"), "utf8"),
);
const commonEn = JSON.parse(
  fs.readFileSync(path.join(root, "packages/i18n-common/messages/common.en.json"), "utf8"),
);
const AUTH_KEYS = Object.keys(commonAz.auth ?? {});

const MESSAGE_DIRS = [
  "era-clinic/messages",
  "era-retail-pos/messages",
  "era-logistics/messages",
  "era-construction/messages",
  "era-crm/messages",
  "era-auto-service/messages",
  "era-wholesale/messages",
  "era-fnb-pos/messages",
  "era-hotel-pms/messages",
  "era-orchestrator/apps/web/messages",
];

function deepKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...deepKeys(v, p));
    else keys.push(p);
  }
  return keys;
}

let patched = 0;
for (const dir of MESSAGE_DIRS) {
  for (const locale of ["az", "ru", "en"]) {
    const file = path.join(root, dir, `${locale}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const base = JSON.parse(
      fs.readFileSync(
        path.join(root, "packages/i18n-common/messages", `common.${locale}.json`),
        "utf8",
      ),
    );
    data.auth ??= {};
    let changed = false;
    for (const k of AUTH_KEYS) {
      const v = base.auth?.[k];
      if (v && data.auth[k] === undefined) {
        data.auth[k] = v;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      console.log("synced auth:", file);
      patched++;
    }
  }
}

const azKeys = new Set(deepKeys(commonAz));
const enKeys = new Set(deepKeys(commonEn));
const missingEn = [...azKeys].filter((k) => !enKeys.has(k));
if (missingEn.length) {
  console.warn("EN missing vs common.az:", missingEn.join(", "));
  process.exitCode = 1;
} else {
  console.log("EN parity OK for i18n-common auth namespace");
}

console.log(`done (${patched} files patched)`);

// Optional full EN fill (run: node tools/fill-en-messages.mjs)
