#!/usr/bin/env node
/**
 * Sync message keys from en.json into ru/az (structure only).
 * Does not overwrite existing translated values.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = path.join(root, 'messages');

function deepMerge(base, overlay) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(prev, value);
    } else if (prev === undefined) {
      out[key] = value;
    }
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'));

for (const locale of ['ru', 'az']) {
  const file = path.join(messagesDir, `${locale}.json`);
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  const merged = deepMerge(en, cur);
  fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

console.log('Synced keys from en → ru, az (missing keys only)');
