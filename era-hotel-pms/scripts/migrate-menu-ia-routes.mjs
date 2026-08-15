/**
 * One-shot: move hotel app routes to MENU-IA-CANON prefixes.
 * Run from era-hotel-pms: node scripts/migrate-menu-ia-routes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');

const moves = [
  // Front Office
  ['availability', 'fo/availability'],
  ['room-plan', 'fo/room-plan'],
  ['in-house', 'fo/in-house'],
  ['reports/reservations', 'fo/reservations'],
  ['reports/group-reservations', 'fo/groups'],
  ['reports/room-changes', 'fo/room-changes'],
  ['reports/reservation-times', 'fo/reservation-times'],
  // Housekeeping
  ['housekeeping/minibar', 'hk/minibar'],
  ['housekeeping/maids', 'hk/maids'],
  ['housekeeping/closed-rooms', 'hk/closed-rooms'],
  ['housekeeping/lost-and-found', 'hk/lost-and-found'],
  // Front Cash
  ['reports/agency-ledger', 'front-cash/agency-ledger'],
  // Night Audit
  ['operations', 'night-audit'],
  ['reports/end-of-day-logs', 'night-audit/logs'],
  ['reports/inhouse-daily', 'night-audit/inhouse-daily'],
  // Distribution
  ['channel', 'distribution/channel'],
  ['admin/contracts', 'distribution/contracts'],
  ['admin/allotment-blocks', 'distribution/allotment-blocks'],
  ['admin/promotion-codes', 'distribution/promotion-codes'],
  ['admin/travel-agencies', 'distribution/travel-agencies'],
  ['admin/child-matrix', 'distribution/child-matrix'],
  ['admin/yield-rules', 'distribution/yield-rules'],
  // Settings
  ['admin/master-data', 'settings/master-data'],
  ['admin/bar-calendar', 'settings/bar-calendar'],
  ['admin/users', 'settings/users'],
  ['admin/integration', 'settings/integration'],
  ['admin/audit', 'settings/audit'],
  ['admin/stock', 'settings/stock'],
  ['admin/import', 'settings/import'],
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function movePath(fromRel, toRel) {
  const from = path.join(app, fromRel);
  const to = path.join(app, toRel);
  if (!fs.existsSync(from)) {
    console.log('skip missing', fromRel);
    return;
  }
  if (fs.existsSync(to)) {
    console.log('skip exists', toRel);
    return;
  }
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
  console.log('moved', fromRel, '→', toRel);
}

// FO rack from root page
const rackDir = path.join(app, 'fo', 'rack');
const rootPage = path.join(app, 'page.tsx');
const rackPage = path.join(rackDir, 'page.tsx');
if (fs.existsSync(rootPage) && !fs.existsSync(rackPage)) {
  ensureDir(rackDir);
  fs.renameSync(rootPage, rackPage);
  console.log('moved page.tsx → fo/rack/page.tsx');
  // placeholder root will be handled by next.config redirect; write minimal redirect page for App Router home
  fs.writeFileSync(
    rootPage,
    `import { redirect } from 'next/navigation';\n\nexport default function HomeRedirect() {\n  redirect('/fo/rack');\n}\n`,
    'utf8',
  );
  console.log('wrote app/page.tsx redirect → /fo/rack');
}

// HK home from housekeeping/page.tsx
const hkPage = path.join(app, 'hk', 'page.tsx');
const oldHk = path.join(app, 'housekeeping', 'page.tsx');
if (fs.existsSync(oldHk) && !fs.existsSync(hkPage)) {
  ensureDir(path.join(app, 'hk'));
  fs.renameSync(oldHk, hkPage);
  console.log('moved housekeeping/page.tsx → hk/page.tsx');
}

for (const [from, to] of moves) {
  movePath(from, to);
}

// Stub NA screens
const stubs = [
  [
    'night-audit/reports/page.tsx',
    `'use client';\n\nimport Link from 'next/link';\nimport { useTranslations } from 'next-intl';\nimport { CARD_CONTAINER_CLASS, PageHeader } from '@era/satellite-kit/ui';\n\nexport default function NightAuditReportsHubPage() {\n  const t = useTranslations('nightAudit');\n  const tc = useTranslations('common');\n  return (\n    <>\n      <PageHeader title={t('reportsTitle')} subtitle={t('reportsSubtitle')} />\n      <section className={\`\${CARD_CONTAINER_CLASS} p-4\`}>\n        <ul className="m-0 list-disc space-y-2 pl-5 text-[13px] text-[#34495E]">\n          <li>\n            <Link href="/night-audit/inhouse-daily" className="text-[#2980B9] hover:underline">\n              {t('reportInhouseDaily')}\n            </Link>\n          </li>\n        </ul>\n        <p className="mt-3 mb-0 text-[12px] text-[#7F8C8D]">{t('reportsHubHint')}</p>\n      </section>\n    </>\n  );\n}\n`,
  ],
  [
    'night-audit/reservation-updates/page.tsx',
    `'use client';\n\nimport { useTranslations } from 'next-intl';\nimport { CARD_CONTAINER_CLASS, PageHeader } from '@era/satellite-kit/ui';\n\nexport default function NightAuditReservationUpdatesPage() {\n  const t = useTranslations('nightAudit');\n  return (\n    <>\n      <PageHeader title={t('reservationUpdatesTitle')} subtitle={t('reservationUpdatesSubtitle')} />\n      <section className={\`\${CARD_CONTAINER_CLASS} p-4 text-[13px] text-[#7F8C8D]\`}>\n        {t('reservationUpdatesPlaceholder')}\n      </section>\n    </>\n  );\n}\n`,
  ],
  [
    'night-audit/year-end/page.tsx',
    `'use client';\n\nimport { useTranslations } from 'next-intl';\nimport { CARD_CONTAINER_CLASS, PageHeader, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';\n\nexport default function NightAuditYearEndPage() {\n  const t = useTranslations('nightAudit');\n  return (\n    <>\n      <PageHeader title={t('yearEndTitle')} subtitle={t('yearEndSubtitle')} />\n      <section className={\`\${CARD_CONTAINER_CLASS} space-y-3 p-4\`}>\n        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('yearEndHint')}</p>\n        <div className="flex flex-wrap gap-2">\n          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled>\n            {t('lastDayOfYear')}\n          </button>\n          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled>\n            {t('firstDayOfYear')}\n          </button>\n        </div>\n      </section>\n    </>\n  );\n}\n`,
  ],
  [
    'front-cash/transactions/page.tsx',
    `'use client';\n\nimport { useTranslations } from 'next-intl';\nimport { CARD_CONTAINER_CLASS, PageHeader } from '@era/satellite-kit/ui';\n\nexport default function FrontCashTransactionsPage() {\n  const t = useTranslations('frontCash');\n  return (\n    <>\n      <PageHeader title={t('transactionsTitle')} subtitle={t('transactionsSubtitle')} />\n      <section className={\`\${CARD_CONTAINER_CLASS} p-4 text-[13px] text-[#7F8C8D]\`}>\n        {t('transactionsPlaceholder')}\n      </section>\n    </>\n  );\n}\n`,
  ],
];

for (const [rel, body] of stubs) {
  const full = path.join(app, rel);
  if (fs.existsSync(full)) {
    console.log('stub exists', rel);
    continue;
  }
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, body, 'utf8');
  console.log('wrote stub', rel);
}

console.log('done');
