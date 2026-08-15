const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');

function fix(rel, needle, insert) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('useMemo')) {
    s = s.replace(
      /import \{ useCallback, useEffect, useState \} from 'react';/,
      "import { useCallback, useEffect, useMemo, useState } from 'react';",
    );
  }
  if (s.includes(insert.slice(0, 40))) {
    console.log('already', rel);
    return;
  }
  if (!s.includes(needle)) throw new Error('needle missing in ' + rel);
  s = s.replace(needle, insert + needle);
  fs.writeFileSync(p, s.replace(/\r\n/g, '\n'), 'utf8');
  console.log('ok', rel);
}

fix(
  'app/transfers/page.tsx',
  '  return (\n    <>\n      <PageHeader\n        title={t(\'title\')}',
  `  const visibleOrders = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      \`\${o.reservation.guest.fullName} \${o.flightNo ?? ''} \${o.status} \${o.direction}\`
        .toLowerCase()
        .includes(q),
    );
  }, [orders, searchApplied]);

`,
);

fix(
  'app/banquets/page.tsx',
  '  return (\n    <>\n      <PageHeader\n        title={t(\'title\')}',
  `  const visibleEvents = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) =>
      \`\${ev.eventName} \${ev.saloon.name} \${ev.status}\`.toLowerCase().includes(q),
    );
  }, [events, searchApplied]);

`,
);

// channel search
{
  const p = path.join(root, 'app/channel/page.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('useMemo')) {
    s = s.replace(
      "import { useCallback, useEffect, useState } from 'react';",
      "import { useCallback, useEffect, useMemo, useState } from 'react';",
    );
  }
  if (!s.includes('visibleErrors')) {
    s = s.replace(
      '  function formatSyncTime(iso: string | null) {',
      `  const q = searchApplied.trim().toLowerCase();
  const visibleErrors = useMemo(() => {
    if (!q) return errors;
    return errors.filter((e) =>
      \`\${e.otaReference ?? ''} \${e.errorMessage}\`.toLowerCase().includes(q),
    );
  }, [errors, q]);
  const visibleChannels = useMemo(() => {
    if (!q) return channels;
    return channels.filter((c) =>
      \`\${c.code} \${c.name}\`.toLowerCase().includes(q),
    );
  }, [channels, q]);
  const visibleStopSells = useMemo(() => {
    if (!q) return stopSells;
    return stopSells.filter((x) =>
      \`\${x.date} \${x.note ?? ''} \${x.roomType?.code ?? ''}\`.toLowerCase().includes(q),
    );
  }, [stopSells, q]);

  function formatSyncTime(iso: string | null) {`,
    );
    s = s.replace(/\{channels\.map\(/g, '{visibleChannels.map(');
    s = s.replace(/\{errors\.map\(/g, '{visibleErrors.map(');
    s = s.replace(/\{stopSells\.map\(/g, '{visibleStopSells.map(');
  }
  fs.writeFileSync(p, s.replace(/\r\n/g, '\n'), 'utf8');
  console.log('ok channel');
}

console.log('memos done');
