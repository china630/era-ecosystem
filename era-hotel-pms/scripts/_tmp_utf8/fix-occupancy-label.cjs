const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../../app/reports/occupancy/page.tsx');
let s = fs.readFileSync(p, 'utf8');
const next = s.replace(
  /label=\{t\('days30'\)\.includes\('30'\) \? tc\('date'\) : tc\('date'\)\}/,
  "label={t('periodDays')}",
);
if (next === s) {
  const m = s.match(/label=\{[^}]+\}/);
  console.log('no match; sample:', m && m[0]);
  process.exit(1);
}
fs.writeFileSync(p, next, 'utf8');
console.log('ok occupancy label');
