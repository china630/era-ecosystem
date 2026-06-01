#!/usr/bin/env node
/**
 * 1) Full key set from en.json
 * 2) Preserve locale strings from git HEAD where they differ from en (lost after bulk merge)
 * 3) Apply wave-b-translations.json overlays
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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
    } else {
      out[key] = value;
    }
  }
  return out;
}

function leafPaths(obj, prefix = '') {
  const paths = [];
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...leafPaths(value, p));
    } else {
      paths.push(p);
    }
  }
  return paths;
}

function getAt(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => acc?.[part], obj);
}

function preservedOverlay(en, locale) {
  const out = {};
  for (const dotPath of leafPaths(en)) {
    const enVal = getAt(en, dotPath);
    const locVal = getAt(locale, dotPath);
    if (typeof enVal === 'string' && typeof locVal === 'string' && locVal !== enVal) {
      const parts = dotPath.split('.');
      let cursor = out;
      for (let i = 0; i < parts.length - 1; i++) {
        cursor[parts[i]] = cursor[parts[i]] ?? {};
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = locVal;
    }
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'));
const waveB = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts', 'wave-b-translations.json'), 'utf8'),
);

for (const locale of ['ru', 'az']) {
  const headRaw = execSync(`git show HEAD:era-hotel-pms/messages/${locale}.json`, {
    encoding: 'utf8',
    cwd: path.join(root, '..'),
  });
  const head = JSON.parse(headRaw);
  let merged = structuredClone(en);
  merged = deepMerge(merged, preservedOverlay(en, head));
  merged = deepMerge(merged, waveB[locale] ?? {});
  fs.writeFileSync(
    path.join(messagesDir, `${locale}.json`),
    `${JSON.stringify(merged, null, 2)}\n`,
    'utf8',
  );
}

console.log('Restored HEAD translations + Wave B overlays for ru, az');
