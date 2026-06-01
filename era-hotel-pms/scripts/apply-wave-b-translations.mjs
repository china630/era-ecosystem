#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const overlay = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts', 'wave-b-translations.json'), 'utf8'),
);

function deepOverlay(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepOverlay(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

for (const locale of ['ru', 'az']) {
  const file = path.join(root, 'messages', `${locale}.json`);
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepOverlay(cur, overlay[locale]);
  fs.writeFileSync(file, `${JSON.stringify(cur, null, 2)}\n`, 'utf8');
}

console.log('Applied Wave B translations to ru, az');
