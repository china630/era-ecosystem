'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import {
  normalizeWipeSelection,
  OPS_PARENTS,
  OPS_WIPE_UI_KEYS,
  type OpsWipeKey,
} from '@/lib/ops-wipe-selection';

type Counts = Record<string, number>;

const confirmFormId = 'ops-wipe-confirm-form';

export default function OpsWipePage() {
  const t = useTranslations('opsWipe');
  const tc = useTranslations('common');
  const { isPlatformSuperAdmin, loading: authLoading } = useAuth();
  const [organizationId, setOrganizationId] = useState('');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [opsOn, setOpsOn] = useState<Set<string>>(() => new Set(OPS_WIPE_UI_KEYS));

  function toggleOps(key: OpsWipeKey) {
    setOpsOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        for (const parent of OPS_PARENTS[key]) next.delete(parent);
      } else next.add(key);
      return new Set(normalizeWipeSelection([...next]));
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ops-wipe');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      setOrganizationId(data.organizationId);
      setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    if (isPlatformSuperAdmin) void load();
  }, [isPlatformSuperAdmin, load]);

  if (authLoading) return null;
  if (!isPlatformSuperAdmin) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  const total = counts
    ? OPS_WIPE_UI_KEYS.reduce((sum, key) => sum + (opsOn.has(key) ? (counts[key] ?? 0) : 0), 0)
    : 0;

  async function wipe(e: React.FormEvent) {
    e.preventDefault();
    if (phrase !== 'WIPE') {
      showApiError({ error: t('phraseMismatch') });
      return;
    }
    setBusy(true);
    const res = await fetch('/api/admin/ops-wipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        confirmPhrase: phrase,
        ops: [...opsOn],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    setConfirmOpen(false);
    setPhrase('');
    setCounts(data.counts);
    showSuccess(t('done'));
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('bucketOps')}</h2>
            <p className="m-0 text-[12px] text-[#7F8C8D]">
              {t('orgLabel')}: <span className="font-mono">{organizationId || '—'}</span>
            </p>
            <p className="m-0 mt-1 text-[12px] text-[#7F8C8D]">{t('linkHint')}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()} disabled={loading}>
              {t('recount')}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!counts || opsOn.size === 0 || total === 0 || loading}
              onClick={() => {
                setPhrase('');
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('wipe')}
            </button>
          </div>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('entity')}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{t('rows')}</th>
              </tr>
            </thead>
            <tbody>
              {OPS_WIPE_UI_KEYS.map((key) => (
                <tr key={key} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opsOn.has(key)}
                        onChange={() => toggleOps(key)}
                      />
                      {t(`entities.${key}`)}
                    </label>
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    {counts ? String(counts[key] ?? 0) : '…'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-[#34495E]">{t('keptTitle')}</h2>
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('keptBody')}</p>
      </section>

      <EraModal
        open={confirmOpen}
        title={t('confirmTitle')}
        onClose={() => setConfirmOpen(false)}
        footer={
          <EraModalFooter
            formId={confirmFormId}
            onCancel={() => setConfirmOpen(false)}
            busy={busy}
            submitLabel={t('wipe')}
          />
        }
      >
        <form id={confirmFormId} onSubmit={wipe} className={FORM_STACK_CLASS}>
          <p className="m-0 text-[13px] text-[#C0392B]">{t('confirmBody', { total })}</p>
          <Field
            label={t('phraseLabel')}
            preset="code"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value.toUpperCase())}
            autoComplete="off"
            required
          />
        </form>
      </EraModal>
    </>
  );
}
