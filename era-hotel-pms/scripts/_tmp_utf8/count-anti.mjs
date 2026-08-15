import fs from 'fs';
import path from 'path';

const root = path.resolve('app');
let date = 0;
let dt = 0;
let prompt = 0;
let appshell = 0;
const hits = [];

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'page.tsx') {
      const t = fs.readFileSync(p, 'utf8');
      const dc = (t.match(/type=["']date["']/g) || []).length;
      const dtc = (t.match(/datetime-local/g) || []).length;
      const pc = (t.match(/window\.prompt/g) || []).length;
      const ac = (t.match(/from ['"]@\/components\/layout\/AppShell['"]/g) || []).length;
      date += dc;
      dt += dtc;
      prompt += pc;
      appshell += ac;
      if (dc || dtc || pc || ac) {
        hits.push({
          file: path.relative(root, p).replace(/\\/g, '/'),
          date: dc,
          dt: dtc,
          prompt: pc,
          appshell: ac,
        });
      }
    }
  }
}

walk(root);
for (const h of hits) console.log(JSON.stringify(h));
console.log('TOTALS', JSON.stringify({ date, datetimeLocal: dt, prompt, appshellImport: appshell }));
