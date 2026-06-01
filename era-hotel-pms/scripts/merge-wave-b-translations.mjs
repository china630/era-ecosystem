import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const patchFiles = [
  'wave-b-translations.json',
  'locale-nav-fo.json',
  'hotel-fo-full-locales.json',
];
const patch = {};
for (const file of patchFiles) {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  for (const locale of ['ru', 'az']) {
    patch[locale] = deepMerge(patch[locale] ?? {}, p[locale] ?? {});
  }
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      target[key] = deepMerge(
        target[key] && typeof target[key] === 'object' ? target[key] : {},
        sv,
      );
    } else {
      target[key] = sv;
    }
  }
  return target;
}

for (const locale of ['ru', 'az']) {
  const file = path.join(root, 'messages', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (patch[locale]) deepMerge(data, patch[locale]);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Merged wave-b patches into ${locale}.json`);
}
