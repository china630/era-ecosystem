const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');

function rw(rel, transform) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');
  s = transform(s);
  fs.writeFileSync(p, s.replace(/\r\n/g, '\n'), 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16 ' + rel);
  console.log('ok', rel);
}

function ensureImport(s, names) {
  // add names to first @era/satellite-kit/ui import block
  const re = /import \{([\s\S]*?)\} from '@era\/satellite-kit\/ui';/;
  const m = s.match(re);
  if (!m) throw new Error('no ui import');
  const current = m[1]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const set = new Set(current);
  for (const n of names) set.add(n);
  const body = [...set].sort().join(',\n  ');
  return s.replace(re, `import {\n  ${body},\n} from '@era/satellite-kit/ui';`);
}

function stripAppShell(s) {
  s = s.replace(
    /import AppShell(?:, \{([^}]*)\})? from '@\/components\/layout\/AppShell';\n?/,
    (_m, inner) => {
      if (!inner) return '';
      const keep = inner
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x && x !== 'StatusMessage');
      if (!keep.length) return '';
      return `import { ${keep.join(', ')} } from '@/components/layout/AppShell';\n`;
    },
  );
  s = s.replace(
    /return \(\s*<AppShell[^>]*>\s*<p className="text-sm text-red-600">\{tc\('accessDenied'\)\}<\/p>\s*<\/AppShell>\s*\);/g,
    "return <p className=\"text-sm text-[#7F8C8D]\">{tc('accessDenied')}</p>;",
  );
  s = s.replace(
    /return \(\s*<AppShell[^>]*>\s*<p className="text-\[13px\] text-\[#7F8C8D\]">\{tc\('([^']+)'\)\}<\/p>\s*<\/AppShell>\s*\);/g,
    (_m, key) => `return <p className="text-[13px] text-[#7F8C8D]">{tc('${key}')}</p>;`,
  );
  s = s.replace(/<AppShell[^>]*>\s*/g, '<>\n      ');
  s = s.replace(/\s*<\/AppShell>/g, '\n    </>');
  return s;
}

const FILTER_BAR = `
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => setSearchApplied(searchDraft)}
        onReset={() => {
          setSearchDraft('');
          setSearchApplied('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
      </EraListFilterBar>
`;

function injectSearchState(s) {
  if (s.includes('searchDraft')) return s;
  return s.replace(
    /const \[msg, setMsg\] = useState<string \| null>\(null\);/,
    `const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');`,
  );
}

function replaceMsgWithToasts(s, tKeys) {
  // setMsg(res.ok ? t('x') : data.error ?? tc('error'))
  s = s.replace(
    /setMsg\(res\.ok \? ([^:]+) : data\.error \?\? tc\('error'\)\);/g,
    (_m, okExpr) =>
      `if (!res.ok) { showApiError(data, tc('error')); return; }
    showSuccess(${okExpr});`,
  );
  s = s.replace(
    /if \(!reservationId[^}]+setMsg\(([^)]+)\);\s*return;\s*\}/gs,
    (m) => m.replace(/setMsg\(([^)]+)\)/, 'showApiError({ error: $1 })'),
  );
  s = s.replace(
    /if \(!eventName[^}]+setMsg\(([^)]+)\);\s*return;\s*\}/gs,
    (m) => m.replace(/setMsg\(([^)]+)\)/, 'showApiError({ error: $1 })'),
  );
  s = s.replace(/setMsg\((t\('[^']+'\))\);/g, 'showApiError({ error: $1 });');
  s = s.replace(/setMsg\(t\('selectVehicle'\)\);/g, "showApiError({ error: t('selectVehicle') });");
  s = s.replace(/<StatusMessage>\{msg\}<\/StatusMessage>\n?/, '');
  s = s.replace(/const \[msg, setMsg\] = useState<string \| null>\(null\);\n?/, '');
  return s;
}

// ---- transfers ----
rw('app/transfers/page.tsx', (s) => {
  s = ensureImport(s, [
    'EraListFilterBar',
    'Field',
    'PageHeader',
    'showApiError',
    'showSuccess',
    'FORM_FIELD_GROUP_CLASS',
    'FORM_STACK_CLASS',
    'MODAL_FIELD_LABEL_CLASS',
    'MODAL_INPUT_CLASS',
    'PRIMARY_BUTTON_CLASS',
    'SECONDARY_BUTTON_CLASS',
  ]);
  s = s.replace(/import \{ PageHeader \} from '@era\/satellite-kit\/ui';\n?/, '');
  s = stripAppShell(s);
  s = injectSearchState(s);
  s = s.replace(
    /import \{ useCallback, useEffect, useState \} from 'react';/,
    "import { useCallback, useEffect, useMemo, useState } from 'react';",
  );
  // book validation
  s = s.replace(
    `if (!reservationId || !pickupAt || !price) {
      setMsg(t('missingFields'));
      return;
    }`,
    `if (!reservationId || !pickupAt || !price) {
      showApiError({ error: t('missingFields') });
      return;
    }`,
  );
  s = s.replace(
    `setMsg(res.ok ? t('booked') : data.error ?? tc('error'));
    if (res.ok) {
      setModalOpen(false);
      await load();
    }`,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('booked'));
    setModalOpen(false);
    await load();`,
  );
  s = s.replace(
    `if (!vehicleId) {
      setMsg(t('selectVehicle'));
      return;
    }`,
    `if (!vehicleId) {
      showApiError({ error: t('selectVehicle') });
      return;
    }`,
  );
  s = s.replace(
    `setMsg(res.ok ? t('assigned') : data.error ?? tc('error'));
    if (res.ok) await load();`,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('assigned'));
    await load();`,
  );
  s = s.replace(
    `setMsg(res.ok ? t('completed') : data.error ?? tc('error'));
    if (res.ok) await load();`,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('completed'));
    await load();`,
  );
  s = s.replace(/<StatusMessage>\{msg\}<\/StatusMessage>\n?/, FILTER_BAR);
  s = s.replace(/const \[msg, setMsg\] = useState<string \| null>\(null\);\n?/, '');
  if (!s.includes('const visibleOrders')) {
    s = s.replace(
      '  return (\n    <>\n      <PageHeader',
      `  const visibleOrders = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      \`\${o.reservation.guest.fullName} \${o.flightNo ?? ''} \${o.status} \${o.direction}\`
        .toLowerCase()
        .includes(q),
    );
  }, [orders, searchApplied]);

  return (
    <>
      <PageHeader`,
    );
    s = s.replace('{orders.map((o) => (', '{visibleOrders.map((o) => (');
    s = s.replace('{orders.length === 0 && (', '{visibleOrders.length === 0 && (');
  }
  return s;
});

// ---- banquets ----
rw('app/banquets/page.tsx', (s) => {
  s = ensureImport(s, [
    'DatePicker',
    'EraListFilterBar',
    'Field',
    'PageHeader',
    'showApiError',
    'showSuccess',
    'FORM_FIELD_GROUP_CLASS',
    'FORM_STACK_CLASS',
    'MODAL_FIELD_LABEL_CLASS',
    'MODAL_INPUT_CLASS',
    'PRIMARY_BUTTON_CLASS',
    'SECONDARY_BUTTON_CLASS',
  ]);
  s = s.replace(/import \{ PageHeader \} from '@era\/satellite-kit\/ui';\n?/, '');
  s = stripAppShell(s);
  s = s.replace(
    /import \{ useCallback, useEffect, useState \} from 'react';/,
    "import { useCallback, useEffect, useMemo, useState } from 'react';",
  );
  s = injectSearchState(s);
  s = s.replace(
    `if (!eventName || !saloonId || !eventDate || !pax) {
      setMsg(t('missingFields'));
      return;
    }`,
    `if (!eventName || !saloonId || !eventDate || !pax) {
      showApiError({ error: t('missingFields') });
      return;
    }`,
  );
  s = s.replace(
    `setMsg(res.ok ? t('created') : data.error ?? tc('error'));
    if (res.ok) {
      setModalOpen(false);
      setEventName('');
      await load();
    }`,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('created'));
    setModalOpen(false);
    setEventName('');
    await load();`,
  );
  s = s.replace(
    `setMsg(res.ok ? t('confirmed') : data.error ?? tc('error'));
    if (res.ok) await load();`,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('confirmed'));
    await load();`,
  );
  s = s.replace(/<StatusMessage>\{msg\}<\/StatusMessage>\n?/, FILTER_BAR);
  s = s.replace(/const \[msg, setMsg\] = useState<string \| null>\(null\);\n?/, '');
  s = s.replace(
    `<div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('eventDate')}</label>
              <input
                type="date"
                className={MODAL_INPUT_CLASS}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>`,
    `<DatePicker
              label={t('eventDate')}
              value={eventDate}
              onChange={setEventDate}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />`,
  );
  if (!s.includes('const visibleEvents')) {
    s = s.replace(
      '  return (\n    <>\n      <PageHeader',
      `  const visibleEvents = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) =>
      \`\${ev.eventName} \${ev.saloon.name} \${ev.status}\`.toLowerCase().includes(q),
    );
  }, [events, searchApplied]);

  return (
    <>
      <PageHeader`,
    );
    s = s.replace('{events.map((ev) => (', '{visibleEvents.map((ev) => (');
  }
  return s;
});

// ---- procedures ----
rw('app/procedures/page.tsx', (s) => {
  s = ensureImport(s, [
    'EraListFilterBar',
    'Field',
    'PageHeader',
    'showApiError',
    'showSuccess',
    'FORM_FIELD_GROUP_CLASS',
    'FORM_STACK_CLASS',
    'MODAL_FIELD_LABEL_CLASS',
    'MODAL_INPUT_CLASS',
    'PRIMARY_BUTTON_CLASS',
    'SECONDARY_BUTTON_CLASS',
  ]);
  s = s.replace(/import \{ PageHeader \} from '@era\/satellite-kit\/ui';\n?/, '');
  s = stripAppShell(s);
  s = s.replace(
    /import \{ useCallback, useEffect, useState \} from 'react';/,
    "import { useCallback, useEffect, useMemo, useState } from 'react';",
  );
  s = injectSearchState(s);
  s = s.replace(
    `if (!reservationId || !serviceId || !startAt) {
      setMsg(t('missingFields'));
      return;
    }`,
    `if (!reservationId || !serviceId || !startAt) {
      showApiError({ error: t('missingFields') });
      return;
    }`,
  );
  s = s.replace(
    `setMsg(res.ok ? t('booked') : data.error ?? tc('error'));
    if (res.ok) {
      setModalOpen(false);
      await load();
    }`,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('booked'));
    setModalOpen(false);
    await load();`,
  );
  s = s.replace(
    /setMsg\(\s*res\.ok\s*\?\s*action === 'finish'[\s\S]*?:\s*data\.error \?\? tc\('error'\),\s*\);\s*if \(res\.ok\) await load\(\);/,
    `if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(
      action === 'finish'
        ? data.includedInPackage
          ? t('finishedIncluded')
          : t('finishedExtra')
        : t('noShow'),
    );
    await load();`,
  );
  s = s.replace(/<StatusMessage>\{msg\}<\/StatusMessage>\n?/, FILTER_BAR);
  s = s.replace(/const \[msg, setMsg\] = useState<string \| null>\(null\);\n?/, '');
  if (!s.includes('const visibleAppointments')) {
    s = s.replace(
      '  return (\n    <>\n      <PageHeader',
      `  const visibleAppointments = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((a) =>
      \`\${a.reservation.guest.fullName} \${a.service.name} \${a.staffName ?? ''} \${a.status}\`
        .toLowerCase()
        .includes(q),
    );
  }, [appointments, searchApplied]);

  return (
    <>
      <PageHeader`,
    );
    s = s.replace(
      /\{appointments\.map\(\(a\) => \(/,
      '{visibleAppointments.map((a) => (',
    );
  }
  return s;
});

// ---- channel ----
rw('app/channel/page.tsx', (s) => {
  s = ensureImport(s, [
    'DatePicker',
    'EraListFilterBar',
    'Field',
    'PageHeader',
    'showApiError',
    'showSuccess',
  ]);
  s = s.replace(/import \{ PageHeader \} from '@era\/satellite-kit\/ui';\n?/, '');
  s = stripAppShell(s);
  // replace StatusMessage with filter for availability dates + search
  s = s.replace(
    /const \[msg, setMsg\] = useState<string \| null>\(null\);/,
    `const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [availFromDraft, setAvailFromDraft] = useState(new Date().toISOString().slice(0, 10));
  const [availToDraft, setAvailToDraft] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );`,
  );
  // sync avail drafts with applied when apply
  s = s.replace(/<StatusMessage>\{msg\}<\/StatusMessage>\n?/, `
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => {
          setSearchApplied(searchDraft);
          setAvailFrom(availFromDraft);
          setAvailTo(availToDraft);
        }}
        onReset={() => {
          setSearchDraft('');
          setSearchApplied('');
          const from = new Date().toISOString().slice(0, 10);
          const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
          setAvailFromDraft(from);
          setAvailToDraft(to);
          setAvailFrom(from);
          setAvailTo(to);
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <DatePicker
          label={tc('from')}
          value={availFromDraft}
          onChange={setAvailFromDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={availToDraft}
          onChange={setAvailToDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
`);
  // remove old date inputs in availability section
  s = s.replace(
    `<div className="mb-2 flex gap-2">
          <input type="date" className="rounded border px-2 py-1 text-[13px]" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} />
          <input type="date" className="rounded border px-2 py-1 text-[13px]" value={availTo} onChange={(e) => setAvailTo(e.target.value)} />
        </div>`,
    '',
  );
  // stop sell date -> DatePicker
  s = s.replace(
    `<div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stop-date">
              {tc('date')}
            </label>
            <input
              id="stop-date"
              type="date"
              required
              className={MODAL_INPUT_CLASS}
              value={stopDate}
              onChange={(e) => setStopDate(e.target.value)}
            />
          </div>`,
    `<DatePicker
            label={tc('date')}
            value={stopDate}
            onChange={setStopDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
            required
          />`,
  );
  // setMsg usages -> showApiError / showSuccess (broad)
  s = s.replace(/setMsg\(([^)]+)\);/g, (m, expr) => {
    if (expr.includes('null')) return '';
    if (expr.startsWith('t(') || expr.startsWith('tc(') || expr.includes('error') || expr.includes('err')) {
      // success strings often don't contain 'error'
      if (/Failed|failed|error|Error|err\b/.test(expr) || expr.includes('data.error') || expr === 'err') {
        return `showApiError({ error: ${expr} });`;
      }
      return `showSuccess(${expr});`;
    }
    return `showApiError({ error: ${expr} });`;
  });
  // lastSyncError still uses text-rose - that's ok (status display not load error)
  return s;
});

console.log('ops3 done');
