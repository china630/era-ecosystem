const fs = require('fs');

const files = [
  'app/guests/page.tsx',
  'src/components/wave-b/SimpleCrudPage.tsx',
  'app/reports/reservations/page.tsx',
  'app/reports/group-reservations/page.tsx',
  'app/reports/reservation-times/page.tsx',
  'app/reports/end-of-day-logs/page.tsx',
  'app/reports/inhouse-daily/page.tsx',
  'app/reports/room-changes/page.tsx',
  'app/reports/analytics/page.tsx',
  'app/reports/occupancy/page.tsx',
  'app/reports/reconciliation/page.tsx',
  'app/reports/invoices/page.tsx',
  'app/reports/agency-ledger/page.tsx',
  'app/reports/agency-profitability/page.tsx',
  'app/in-house/page.tsx',
  'app/front-cash/pending/page.tsx',
  'app/transfers/page.tsx',
  'app/transfers/airport/page.tsx',
  'app/channel/page.tsx',
  'app/banquets/page.tsx',
  'app/banquets/reports/profitability/page.tsx',
  'app/migration/page.tsx',
  'app/procedures/page.tsx',
  'app/service/page.tsx',
  'app/spa/reservations/page.tsx',
  'app/spa/staff-match/page.tsx',
];

let bad = 0;
for (const f of files) {
  const b = fs.readFileSync(f);
  const utf16 = b.length > 1 && b[1] === 0;
  const s = utf16 ? b.toString('utf16le') : b.toString('utf8');
  const hasBar = s.includes('EraListFilterBar');
  const dates = (s.match(/type=["']date["']/g) || []).length;
  const appShell = (s.match(/<AppShell/g) || []).length;
  const statusMsg = s.includes('StatusMessage');
  const setMsg = /\bsetMsg\b/.test(s);
  const showErr = s.includes('showApiError');
  const issues = [];
  if (utf16) issues.push('UTF16');
  if (!hasBar) issues.push('NO_FILTER_BAR');
  if (dates) issues.push('type=date:' + dates);
  if (appShell) issues.push('AppShell:' + appShell);
  if (statusMsg) issues.push('StatusMessage');
  if (setMsg) issues.push('setMsg');
  if (!showErr) issues.push('NO_showApiError');
  if (issues.length) {
    bad++;
    console.log('FAIL', f, issues.join(', '));
  } else {
    console.log('OK', f);
  }
}
console.log('summary bad=', bad, 'total=', files.length);
process.exit(bad ? 1 : 0);
