#!/usr/bin/env node
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

const waveD2 = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'wave-d2-i18n.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'messages', 'en.json'), 'utf8'));

for (const locale of ['az', 'ru']) {
  const file = path.join(root, 'messages', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMergeMissing(data, en);
  for (const [dotPath, tr] of Object.entries(waveD2)) {
    if (tr[locale]) setAt(data, dotPath, tr[locale]);
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log('wave-d2 i18n: merged missing keys + FO legend/nav patches');
