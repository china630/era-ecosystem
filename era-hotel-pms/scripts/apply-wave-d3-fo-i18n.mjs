#!/usr/bin/env node
/**
 * Apply FO AZ/RU translations from wave-d2 + wave-d3 JSON maps.
 * Merges missing keys from en.json, then overlays translations.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function setAt(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deepMergeMissing(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] ?? {};
      deepMergeMissing(target[k], v);
    } else if (target[k] === undefined) {
      target[k] = v;
    }
  }
}

function loadMaps() {
  const dir = path.join(root, 'scripts');
  const maps = {};
  for (const file of ['wave-d2-i18n.json', 'wave-d3-fo-i18n.json']) {
    const p = path.join(dir, file);
    if (fs.existsSync(p)) {
      Object.assign(maps, JSON.parse(fs.readFileSync(p, 'utf8')));
    }
  }
  return maps;
}

const en = JSON.parse(fs.readFileSync(path.join(root, 'messages', 'en.json'), 'utf8'));
const maps = loadMaps();

for (const locale of ['az', 'ru']) {
  const file = path.join(root, 'messages', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMergeMissing(data, en);
  let patched = 0;
  for (const [dotPath, tr] of Object.entries(maps)) {
    if (tr[locale] !== undefined) {
      setAt(data, dotPath, tr[locale]);
      patched++;
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${locale}.json: ${patched} FO keys patched`);
}

console.log('Done. Run: npm run verify:i18n');
