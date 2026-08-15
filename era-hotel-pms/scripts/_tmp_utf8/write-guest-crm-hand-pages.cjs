const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

function writeUtf8(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = content.replace(/\r\n/g, '\n');
  fs.writeFileSync(p, data, 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16: ' + p);
  console.log('ok', rel);
}

writeUtf8(
  'app/guests/[id]/accompanying/page.tsx',
  `'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader, EraListFilterBar, Field, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

export default function GuestAccompanyingPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const { rows } = useGuestCrmList(\`/api/guests/\${id}/accompanying\`);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.firstName, r.lastName, r.roomNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader
        title={t('crmPages.accompanyingTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]\`}>
          {filtered.map((r) => (
            <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
              {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'} — Room{' '}
              {String(r.roomNumber ?? '—')}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
`,
);

writeUtf8(
  'app/guests/[id]/booker-history/page.tsx',
  `'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader, EraListFilterBar, Field, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

export default function GuestBookerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const { rows } = useGuestCrmList(\`/api/guests/\${id}/booker-history\`);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const guest = r.guest as { fullName?: string } | undefined;
      return \`\${guest?.fullName ?? ''} \${String(r.checkInDate)}\`.toLowerCase().includes(q);
    });
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader
        title={t('crmPages.bookerTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]\`}>
          {filtered.map((r) => {
            const guest = r.guest as { fullName?: string } | undefined;
            return (
              <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
                For {guest?.fullName ?? 'guest'} — {String(r.checkInDate).slice(0, 10)}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
`,
);

writeUtf8(
  'app/guests/[id]/contact-logs/page.tsx',
  `'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader, EraListFilterBar, Field, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

export default function GuestContactLogsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const { rows } = useGuestCrmList(\`/api/guests/\${id}/contact-logs\`);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.channel} \${r.contactDate}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader
        title={t('crm.contactLogs')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]\`}>
          {filtered.map((r) => (
            <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
              {String(r.channel)} — {String(r.contactDate).slice(0, 10)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
`,
);

writeUtf8(
  'app/guests/[id]/sources/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PageHeader,
  EraListFilterBar,
  Field,
  CARD_CONTAINER_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';

export default function GuestSourcesPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [sources, setSources] = useState<Array<Record<string, unknown>>>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(\`/api/guests/\${id}/reservation-analytics\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((s) =>
      \`\${s.sourceName} \${s.resSource}\`.toLowerCase().includes(q),
    );
  }, [sources, searchApplied]);

  return (
    <>
      <PageHeader
        title={t('crmPages.sourcesTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]\`}>
          {filtered.map((s) => (
            <li key={String(s.resSource)} className="rounded-lg border border-[#D5DADF] p-3">
              {String(s.sourceName)} — {String(s.roomCount)} stays, {Number(s.totalRevenue).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
`,
);

writeUtf8(
  'app/guests/[id]/trip-reasons/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PageHeader,
  EraListFilterBar,
  Field,
  CARD_CONTAINER_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';

export default function GuestTripReasonsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(\`/api/guests/\${id}/reservation-analytics\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.tripReasons) ? data.tripReasons : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.tripReason).toLowerCase().includes(q));
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader
        title={t('crmPages.tripReasonsTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]\`}>
          {filtered.map((r) => (
            <li key={String(r.tripReason)} className="rounded-lg border border-[#D5DADF] p-3">
              {String(r.tripReason)} — {String(r.resCount)} stays
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
`,
);

writeUtf8(
  'app/guests/[id]/archive/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  Field,
  ModalShell,
  ModalFooter,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Row = {
  id: string;
  title: string;
  docType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export default function GuestArchivePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('ID');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(\`/api/guests/\${id}/archive\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => \`\${r.title} \${r.docType}\`.toLowerCase().includes(q));
  }, [rows, searchApplied]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocType('ID');
    setPendingFile(file);
  }

  async function submitUpload() {
    if (!pendingFile) return;
    if (!docType.trim()) {
      showApiError({ error: tc('required') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(\`/api/guests/\${id}/archive\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingFile.name,
          docType: docType.trim(),
          mimeType: pendingFile.type,
          sizeBytes: pendingFile.size,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setPendingFile(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('crmPages.archiveTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
        actions={
          <label className={\`\${PRIMARY_BUTTON_CLASS} inline-block cursor-pointer\`}>
            {t('crmPages.upload')}
            <input type="file" className="hidden" accept="image/*,.pdf" onChange={onPickFile} />
          </label>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]\`}>
          {filtered.map((r) => (
            <li key={r.id} className="rounded-lg border border-[#D5DADF] p-3">
              <strong>{r.title}</strong> — {r.docType}
              {r.sizeBytes != null ? (
                <span className="text-[#7F8C8D]"> ({Math.round(r.sizeBytes / 1024)} KB)</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ModalShell
        open={!!pendingFile}
        title={t('crmPages.upload')}
        onClose={() => {
          if (!busy) setPendingFile(null);
        }}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => {
              if (!busy) setPendingFile(null);
            }}
            onSubmit={() => void submitUpload()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <div className="space-y-3 text-[13px]">
          <p className="text-[#7F8C8D]">{pendingFile?.name}</p>
          <Field
            label={t('crmPages.docTypePrompt')}
            preset="shortText"
            required
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          />
        </div>
      </ModalShell>
    </>
  );
}
`,
);

console.log('hand pages done');
