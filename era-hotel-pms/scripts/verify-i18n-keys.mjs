#!/usr/bin/env node
/**
 * Fail build when useTranslations/getTranslations namespaces are missing from locale JSON.
 * Merges @era/i18n-common common.*.json with app messages (same as runtime).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = path.join(root, "messages");
const commonDir = path.join(root, "..", "packages", "i18n-common", "messages");
const scanDirs = [path.join(root, "app"), path.join(root, "src")];

const NS_RE =
  /(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g;

function mergeMessages(base, overlay) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = mergeMessages(prev, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function loadMergedNamespaces(locale) {
  const azBase = JSON.parse(
    fs.readFileSync(path.join(commonDir, "common.az.json"), "utf8"),
  );
  const common = JSON.parse(
    fs.readFileSync(path.join(commonDir, `common.${locale}.json`), "utf8"),
  );
  const app = JSON.parse(
    fs.readFileSync(path.join(messagesDir, `${locale}.json`), "utf8"),
  );
  const merged =
    locale === "az"
      ? mergeMessages(mergeMessages(azBase, common), app)
      : mergeMessages(mergeMessages(azBase, app), common);
  return new Set(Object.keys(merged));
}

const namespaces = new Set();
for (const dir of scanDirs) {
  for (const file of walk(dir)) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(NS_RE)) {
      namespaces.add(match[1]);
    }
  }
}

const locales = fs
  .readdirSync(messagesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const errors = [];
for (const locale of locales) {
  const known = loadMergedNamespaces(locale);
  for (const ns of namespaces) {
    if (!known.has(ns)) {
      errors.push(`[${locale}] missing namespace "${ns}" (referenced in app/src)`);
    }
  }
}

if (errors.length) {
  console.error("i18n verification failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

console.log(
  `i18n OK: ${namespaces.size} namespace(s) across ${locales.length} locale file(s)`,
);
