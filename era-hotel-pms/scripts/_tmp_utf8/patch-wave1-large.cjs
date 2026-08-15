/**
 * Surgical patches for large ops pages: strip AppShell, add filter bar hooks,
 * DatePicker, showApiError/showSuccess.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, content) {
  const p = path.join(root, rel);
  fs.writeFileSync(p, content.replace(/\r\n/g, '\n'), 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16 ' + rel);
  console.log('patched', rel);
}

function stripAppShell(src) {
  let s = src;
  s = s.replace(/import AppShell(?:, \{[^}]+\})? from '@\/components\/layout\/AppShell';\n?/, (m) => {
    if (m.includes('PageSection')) {
      return "import { PageSection } from '@/components/layout/AppShell';\n";
    }
    return '';
  });
  // access denied wrappers
  s = s.replace(
    /return \(\s*<AppShell[^>]*>\s*<p className="text-sm text-red-600">\{tc\('accessDenied'\)\}<\/p>\s*<\/AppShell>\s*\);/g,
    "return <p className=\"text-sm text-[#7F8C8D]\">{tc('accessDenied')}</p>;",
  );
  s = s.replace(
    /return \(\s*<AppShell[^>]*>\s*<p className="text-\[13px\] text-\[#7F8C8D\]">\{tc\('(?:noPermission|noPermissionChannel|accessDenied)'\)\}<\/p>\s*<\/AppShell>\s*\);/g,
    (m) => {
      const key = m.match(/tc\('([^']+)'\)/)[1];
      return `return <p className="text-[13px] text-[#7F8C8D]">{tc('${key}')}</p>;`;
    },
  );
  s = s.replace(/<AppShell[^>]*>\s*/g, '<>\n      ');
  s = s.replace(/\s*<\/AppShell>/g, '\n    </>');
  return s;
}

// ---------- front-cash/pending ----------
{
  let s = read('app/front-cash/pending/page.tsx');
  s = s.replace(
    `import {
  CARD_CONTAINER_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';`,
    `import {
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  Field,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';`,
  );
  s = s.replace(
    `  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);`,
    `  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');`,
  );
  s = s.replace(
    `  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/settlement/pending?status=PENDING');
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);`,
    `  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settlement/pending?status=PENDING');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [tc]);`,
  );
  s = s.replace(
    `    setBusy(true);
    setMsg(null);
    const res = await fetch(\`/api/settlement/pending/\${payTarget.id}/pay\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: method }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? t('payFailed'));
      return;
    }
    setPayTarget(null);
    setMsg(t('paySuccess'));
    void load();`,
    `    setBusy(true);
    try {
      const res = await fetch(\`/api/settlement/pending/\${payTarget.id}/pay\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('payFailed'));
        return;
      }
      setPayTarget(null);
      showSuccess(t('paySuccess'));
      void load();
    } finally {
      setBusy(false);
    }`,
  );
  s = s.replace(
    `    setBusy(true);
    setMsg(null);
    const res = await fetch(\`/api/settlement/pending/\${voidTarget.id}/void\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: voidReason.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? t('voidFailed'));
      return;
    }
    setVoidTarget(null);
    setVoidReason('');
    setMsg(t('voidSuccess'));
    void load();`,
    `    setBusy(true);
    try {
      const res = await fetch(\`/api/settlement/pending/\${voidTarget.id}/void\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('voidFailed'));
        return;
      }
      setVoidTarget(null);
      setVoidReason('');
      showSuccess(t('voidSuccess'));
      void load();
    } finally {
      setBusy(false);
    }`,
  );
  s = stripAppShell(s);
  s = s.replace(
    `      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {msg && <StatusMessage>{msg}</StatusMessage>}
      <PageSection>`,
    `      <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
      <PageSection>`,
  );
  // filter rows client-side
  if (!s.includes('const visibleRows')) {
    s = s.replace(
      `  const canPay = can(PERMISSIONS.FOLIO_PAYMENT);
  const canVoid = can(PERMISSIONS.FOLIO_VOID);`,
      `  const canPay = can(PERMISSIONS.FOLIO_PAYMENT);
  const canVoid = can(PERMISSIONS.FOLIO_VOID);
  const visibleRows = rows.filter((row) => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return true;
    return \`\${row.sourceSystem} \${row.sourceRef} \${row.payerLabel ?? ''} \${row.description}\`
      .toLowerCase()
      .includes(q);
  });`,
    );
    s = s.replace('{rows.map((row) => (', '{visibleRows.map((row) => (');
    s = s.replace(
      ') : rows.length === 0 ? (',
      ') : visibleRows.length === 0 ? (',
    );
  }
  write('app/front-cash/pending/page.tsx', s);
}

// ---------- service/page.tsx ----------
{
  let s = read('app/service/page.tsx');
  s = s.replace(
    `import { PageHeader, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';`,
    `import {
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';`,
  );
  s = s.replace(
    `  const t = useTranslations('service');
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [title, setTitle] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);`,
    `  const t = useTranslations('service');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [title, setTitle] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');`,
  );
  s = s.replace(
    `  const load = useCallback(async () => {
    const res = await fetch('/api/service/requests');
    if (!res.ok) {
      setMsg('Failed to load');
      return;
    }
    setRows(await res.json());
  }, []);`,
    `  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/service/requests');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);`,
  );
  s = s.replace(
    `    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/service/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          location: roomNumber ? \`Room \${roomNumber}\` : undefined,
          source: 'STAFF',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle('');
      setRoomNumber('');
      await load();
      setMsg(t('created'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }`,
    `    setBusy(true);
    try {
      const res = await fetch('/api/service/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          location: roomNumber ? \`Room \${roomNumber}\` : undefined,
          source: 'STAFF',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setTitle('');
      setRoomNumber('');
      await load();
      showSuccess(t('created'));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }`,
  );
  s = stripAppShell(s);
  s = s.replace(
    `      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageSection>
        <div className="mb-4 flex flex-wrap gap-2">`,
    `      <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
        />
      </EraListFilterBar>
      <PageSection>
        <div className="mb-4 flex flex-wrap gap-2">`,
  );
  s = s.replace('{msg ? <StatusMessage>{msg}</StatusMessage> : null}\n', '');
  if (!s.includes('visibleRows')) {
    s = s.replace(
      '        <table className="w-full text-sm">',
      `        {(() => null)()}
        <table className="w-full text-sm">`,
    );
    // cleaner: inject filter before map
    s = s.replace(
      '{rows.map((r) => (',
      `{rows
            .filter((r) => {
              const q = searchApplied.trim().toLowerCase();
              if (!q) return true;
              return \`\${r.title} \${r.room?.roomNumber ?? ''} \${r.status} \${r.source}\`.toLowerCase().includes(q);
            })
            .map((r) => (`,
    );
  }
  write('app/service/page.tsx', s);
}

console.log('large patch batch1 done');
