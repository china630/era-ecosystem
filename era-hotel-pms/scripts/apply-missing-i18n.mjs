#!/usr/bin/env node
/**
 * Apply dot-path translations for keys still identical to en.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = {
  ...JSON.parse(
    fs.readFileSync(path.join(root, 'scripts', 'i18n-missing-translations.json'), 'utf8'),
  ),
  ...JSON.parse(
    fs.readFileSync(path.join(root, 'scripts', 'i18n-remainder-translations.json'), 'utf8'),
  ),
};

function setAt(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

for (const locale of ['ru', 'az']) {
  const file = path.join(root, 'messages', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [dotPath, tr] of Object.entries(map)) {
    if (tr[locale]) setAt(data, dotPath, tr[locale]);
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const enFile = path.join(root, 'messages', 'en.json');
const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
for (const [dotPath, tr] of Object.entries(map)) {
  if (tr.en) setAt(en, dotPath, tr.en);
}
fs.writeFileSync(enFile, `${JSON.stringify(en, null, 2)}\n`, 'utf8');

console.log(`Applied ${Object.keys(map).length} translation(s) to en, ru, az`);
