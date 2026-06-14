'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';

type Rule = {
  id: string;
  procedureCodeA: string;
  procedureCodeB: string;
  ruleType: string;
  minHours: number | null;
  note: string | null;
};

export default function ProcedureRulesPage() {
  const t = useTranslations('procedureRules');
  const tc = useTranslations('common');
  const [rules, setRules] = useState<Rule[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    procedureCodeA: '',
    procedureCodeB: '',
    ruleType: 'FORBID_SAME_DAY',
    minHours: '24',
  });

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/procedure-compatibility-rules');
    if (res.ok) {
      const data = await res.json();
      setRules((data.data ?? data) as Rule[]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/procedure-compatibility-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        minHours: form.ruleType === 'MIN_HOURS_GAP' ? Number(form.minHours) : undefined,
      }),
    });
    setMsg(res.ok ? t('added') : tc('failed'));
    if (res.ok) {
      setForm({ procedureCodeA: '', procedureCodeB: '', ruleType: 'FORBID_SAME_DAY', minHours: '24' });
    }
    await load();
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {msg ? <p className="mb-4 text-[13px] text-[#2C3E50]">{msg}</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <form onSubmit={addRule} className="flex flex-wrap gap-2 text-[13px]">
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t('codeA')}
            value={form.procedureCodeA}
            onChange={(e) => setForm({ ...form, procedureCodeA: e.target.value })}
            required
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t('codeB')}
            value={form.procedureCodeB}
            onChange={(e) => setForm({ ...form, procedureCodeB: e.target.value })}
            required
          />
          <select
            className={MODAL_INPUT_CLASS}
            value={form.ruleType}
            onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
          >
            <option value="FORBID_SAME_DAY">FORBID_SAME_DAY</option>
            <option value="MIN_HOURS_GAP">MIN_HOURS_GAP</option>
            <option value="FORBID_SEQUENCE">FORBID_SEQUENCE</option>
          </select>
          {form.ruleType === 'MIN_HOURS_GAP' && (
            <input
              type="number"
              className={`w-20 ${MODAL_INPUT_CLASS}`}
              value={form.minHours}
              onChange={(e) => setForm({ ...form, minHours: e.target.value })}
            />
          )}
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            {t('addRule')}
          </button>
        </form>
      </div>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <ul className="space-y-2 text-[13px]">
          {rules.length === 0 ? (
            <li className="text-[#7F8C8D]">{t('empty')}</li>
          ) : (
            rules.map((r) => (
              <li key={r.id} className="rounded border border-[#ECEFF1] p-2">
                {r.procedureCodeA} + {r.procedureCodeB} — {r.ruleType}
                {r.minHours != null ? ` (${r.minHours}h)` : ''}
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}
