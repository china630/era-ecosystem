import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const src = path.join(pkgRoot, 'build', 'pdf.worker.min.mjs');
const destDir = path.join(here, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('copied pdf.worker.min.mjs → public/');
