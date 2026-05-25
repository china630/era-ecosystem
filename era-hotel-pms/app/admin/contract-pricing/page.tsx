'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Agency {
  id: string;
  code: string;
  name: string;
}

interface RatePlan {
  id: string;
  code: string;
}

interface Rule {
  id: string;
  name: string;
  ruleType: 'DISCOUNT' | 'SUPPLEMENT';
  valuePercent: string;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  agency: Agency | null;
  ratePlan: RatePlan;
}

export default function ContractPricingPage() {
  const { can } = useAuth();
  const t = useTranslations('contractPricing');
  const tc = useTranslations('common');
  const [rules, setRules] = useState<Rule[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [ruleType, setRuleType] = useState<'DISCOUNT' | 'SUPPLEMENT'>('DISCOUNT');
  const [valuePercent, setValuePercent] = useState('10');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    const [r, a, rp] = await Promise.all([
      fetch('/api/admin/contract-pricing').then((res) => res.json()),
      fetch('/api/agencies').then((res) => res.json()),
      fetch('/api/master/rate-plans').then((res) => res.json()),
    ]);
    setRules(r);
    setAgencies(a);
    setRatePlans(rp);
  }

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) void load();
  }, [can]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/contract-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          agencyId: agencyId || undefined,
          ratePlanId,
          ruleType,
          valuePercent: parseFloat(valuePercent),
          validFrom: new Date(validFrom).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      setModalOpen(false);
      setMsg(t('ruleCreated'));
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/admin/contract-pricing/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    });
    await load();
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        }
      />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection className="p-0">
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('rateCode')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agency')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ruleType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('value')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('validFrom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.ratePlan.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.agency?.code ?? t('allAgencies')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.ruleType}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.valuePercent}%</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rule.validFrom.slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void toggleActive(rule)}>
                      {rule.active ? t('active') : t('inactive')}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noRules')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <EraModal
        open={modalOpen}
        title={t('addRule')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId="contract-pricing-form"
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <form id="contract-pricing-form" onSubmit={createRule} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('name')}</label>
            <input className={MODAL_INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('rateCode')}</label>
            <select className={MODAL_INPUT_CLASS} value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)} required>
              <option value="">{tc('select')}</option>
              {ratePlans.map((rp) => (
                <option key={rp.id} value={rp.id}>{rp.code}</option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('agency')}</label>
            <select className={MODAL_INPUT_CLASS} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              <option value="">{t('allAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('ruleType')}</label>
            <select className={MODAL_INPUT_CLASS} value={ruleType} onChange={(e) => setRuleType(e.target.value as 'DISCOUNT' | 'SUPPLEMENT')}>
              <option value="DISCOUNT">{t('discount')}</option>
              <option value="SUPPLEMENT">{t('supplement')}</option>
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('value')}</label>
            <input type="number" min="0.01" max="100" step="0.01" className={MODAL_INPUT_CLASS} value={valuePercent} onChange={(e) => setValuePercent(e.target.value)} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('validFrom')}</label>
            <input type="date" className={MODAL_INPUT_CLASS} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className={MODAL_CHECKBOX_CLASS} defaultChecked readOnly />
            {t('activeByDefault')}
          </label>
        </form>
      </EraModal>
    </AppShell>
  );
}
