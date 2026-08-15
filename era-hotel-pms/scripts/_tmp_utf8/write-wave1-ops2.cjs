const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');

function writeUtf8(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = content.replace(/\r\n/g, '\n');
  fs.writeFileSync(p, data.endsWith('\n') ? data : data + '\n', 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16: ' + p);
  console.log('ok', rel);
}

writeUtf8(
  'app/front-cash/pending/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
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
import { PageSection } from '@/components/layout/AppShell';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type PendingRow = {
  id: string;
  sourceSystem: string;
  sourceRef: string;
  amount: string | number;
  currency: string;
  description: string;
  payerLabel: string | null;
  createdAt: string;
  businessDate: string;
};

export default function FrontCashPendingPage() {
  const { can } = useAuth();
  const t = useTranslations('frontCashPending');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payTarget, setPayTarget] = useState<PendingRow | null>(null);
  const [voidTarget, setVoidTarget] = useState<PendingRow | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
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
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(method: 'CASH' | 'CARD') {
    if (!payTarget) return;
    setBusy(true);
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
    }
  }

  async function voidPending() {
    if (!voidTarget || voidReason.trim().length < 3) return;
    setBusy(true);
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
    }
  }

  const canPay = can(PERMISSIONS.FOLIO_PAYMENT);
  const canVoid = can(PERMISSIONS.FOLIO_VOID);
  const visibleRows = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      \`\${row.sourceSystem} \${row.sourceRef} \${row.payerLabel ?? ''} \${row.description}\`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
      <PageSection>
        <div className={\`\${CARD_CONTAINER_CLASS} overflow-x-auto p-4\`}>
          {loading ? (
            <p className="text-sm text-gray-500">{tc('loading')}</p>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-gray-600">{t('empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">{t('colSource')}</th>
                  <th className="py-2 pr-3">{t('colRef')}</th>
                  <th className="py-2 pr-3">{t('colPayer')}</th>
                  <th className="py-2 pr-3">{t('colDescription')}</th>
                  <th className="py-2 pr-3 text-right">{t('colAmount')}</th>
                  <th className="py-2">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{row.sourceSystem}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.sourceRef.slice(0, 12)}</td>
                    <td className="py-2 pr-3">{row.payerLabel ?? '—'}</td>
                    <td className="py-2 pr-3">{row.description}</td>
                    <td className="py-2 pr-3 text-right font-medium">
                      {Number(row.amount).toFixed(2)} {row.currency}
                    </td>
                    <td className="py-2 space-x-2">
                      {canPay && (
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          onClick={() => setPayTarget(row)}
                        >
                          {t('pay')}
                        </button>
                      )}
                      {canVoid && (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => {
                            setVoidTarget(row);
                            setVoidReason('');
                          }}
                        >
                          {t('void')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageSection>

      <EraModal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={t('payModalTitle')}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPayTarget(null)}>
              {tc('cancel')}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void pay('CASH')}
            >
              {t('payCash')}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void pay('CARD')}
            >
              {t('payCard')}
            </button>
          </div>
        }
      >
        {payTarget && (
          <div className="space-y-3 text-sm">
            <p>{payTarget.description}</p>
            <p className="font-semibold">
              {Number(payTarget.amount).toFixed(2)} {payTarget.currency}
            </p>
            <p className="text-xs text-gray-500">{t('amountReadOnly')}</p>
          </div>
        )}
      </EraModal>

      <EraModal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title={t('voidModalTitle')}
        footer={
          <EraModalFooter
            onCancel={() => setVoidTarget(null)}
            onSubmit={() => void voidPending()}
            busy={busy}
            submitDisabled={voidReason.trim().length < 3}
            submitLabel={t('voidConfirm')}
          />
        }
      >
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t('voidReason')}
          <input
            className={MODAL_INPUT_CLASS}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </label>
      </EraModal>
    </>
  );
}
`,
);

writeUtf8(
  'app/service/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';

type ServiceRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  category: string | null;
  room: { roomNumber: string } | null;
  location: string | null;
};

export default function ServicePage() {
  const t = useTranslations('service');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [title, setTitle] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
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
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRequest() {
    if (!title.trim()) return;
    setBusy(true);
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
    }
  }

  async function setStatus(id: string, status: 'IN_PROGRESS' | 'DONE') {
    try {
      const res = await fetch(\`/api/service/requests/\${id}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.title} \${r.room?.roomNumber ?? ''} \${r.status} \${r.source}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
      <PageSection>
        <div className="mb-4 flex flex-wrap gap-2">
          <Field
            label={t('requestTitle')}
            preset="longText"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field
            label={t('room')}
            preset="shortText"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void createRequest()}>
            {t('add')}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>{t('colTitle')}</th>
              <th>{t('colRoom')}</th>
              <th>{t('colStatus')}</th>
              <th>{t('colSource')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.title}</td>
                <td>{r.room?.roomNumber ?? r.location ?? '—'}</td>
                <td>{r.status}</td>
                <td>{r.source}</td>
                <td className="py-2 space-x-1">
                  {r.status === 'OPEN' ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus(r.id, 'IN_PROGRESS')}>
                      {t('start')}
                    </button>
                  ) : null}
                  {r.status !== 'DONE' ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus(r.id, 'DONE')}>
                      {t('done')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageSection>
    </>
  );
}
`,
);

console.log('ops2 ready');
