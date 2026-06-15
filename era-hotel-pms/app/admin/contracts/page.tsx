'use client';

import { useCallback, useEffect, useState } from 'react';
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

type Agency = { id: string; code: string; name: string };
type RatePlan = { id: string; code: string; name: string; type: string };
type RoomType = { id: string; code: string; name: string };
type Allotment = {
  id: string;
  roomTypeId: string;
  validFrom: string;
  validTo: string;
  nightlyQuota: number;
  roomType: RoomType;
};
type Contract = {
  id: string;
  code: string;
  name: string;
  status: string;
  counterpartyType: string;
  validFrom: string;
  validTo: string | null;
  agency: Agency | null;
  ratePlan: RatePlan;
  allotments: Allotment[];
  _count: { reservations: number };
};

export default function SalesContractsPage() {
  const { can } = useAuth();
  const t = useTranslations('salesContracts');
  const tc = useTranslations('common');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [allotmentModal, setAllotmentModal] = useState<Contract | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [utilizationModal, setUtilizationModal] = useState<{
    code: string;
    reservationCount: number;
    allotmentNights: number;
    consumedNights: number;
    utilizationPercent: number | null;
    totalRevenue: number;
  } | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [allotRoomTypeId, setAllotRoomTypeId] = useState('');
  const [allotFrom, setAllotFrom] = useState('');
  const [allotTo, setAllotTo] = useState('');
  const [allotQuota, setAllotQuota] = useState('20');

  const load = useCallback(async () => {
    const [cRes, aRes, rpRes, rtRes] = await Promise.all([
      fetch('/api/admin/contracts'),
      fetch('/api/admin/travel-agencies'),
      fetch('/api/master/rate-plans'),
      fetch('/api/master/room-types'),
    ]);
    const [cData, aData, rpData, rtData] = await Promise.all([
      cRes.json(),
      aRes.json(),
      rpRes.json(),
      rtRes.json(),
    ]);
    setContracts(Array.isArray(cData) ? cData : []);
    setAgencies(Array.isArray(aData) ? aData : []);
    const derived = (Array.isArray(rpData) ? rpData : []).filter(
      (p: RatePlan) => p.type === 'DERIVED' || p.type === 'BASE',
    );
    setRatePlans(derived);
    setRoomTypes(Array.isArray(rtData) ? rtData : []);
    if (!ratePlanId && derived[0]?.id) setRatePlanId(derived[0].id);
    if (!agencyId && aData[0]?.id) setAgencyId(aData[0].id);
    if (!allotRoomTypeId && rtData[0]?.id) setAllotRoomTypeId(rtData[0].id);
  }, [agencyId, allotRoomTypeId, ratePlanId]);

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) void load();
  }, [can, load]);

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  async function showUtilization(contractId: string) {
    const res = await fetch(`/api/admin/contracts/${contractId}?utilization=1`);
    const data = await res.json();
    if (res.ok) setUtilizationModal(data);
    else setMsg(data.error ?? tc('error'));
  }

  async function createContract(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        name,
        agencyId: agencyId || undefined,
        ratePlanId,
        validFrom,
        validTo: validTo || undefined,
        status: 'ACTIVE',
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('created') : data.error ?? tc('error'));
    if (res.ok) {
      setModalOpen(false);
      await load();
    }
  }

  async function addAllotment(e: React.FormEvent) {
    e.preventDefault();
    if (!allotmentModal) return;
    setBusy(true);
    const res = await fetch(`/api/admin/contracts/${allotmentModal.id}/allotments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: allotRoomTypeId,
        validFrom: allotFrom,
        validTo: allotTo,
        nightlyQuota: Number(allotQuota),
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('allotmentSaved') : data.error ?? tc('error'));
    if (res.ok) {
      setAllotmentModal(null);
      await load();
    }
  }

  async function activate(id: string) {
    const res = await fetch(`/api/admin/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    setMsg(res.ok ? t('activated') : tc('error'));
    if (res.ok) await load();
  }

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('create')}
          </button>
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <p className="mb-4 text-xs text-[#7F8C8D]">{t('legacyNote')}</p>

      <PageSection>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agency')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ratePlan')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('validity')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('allotments')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{c.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.agency?.code ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.ratePlan.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {new Date(c.validFrom).toLocaleDateString()} —{' '}
                    {c.validTo ? new Date(c.validTo).toLocaleDateString() : '∞'}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.allotments.length}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{c.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'DRAFT' && (
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => activate(c.id)}>
                          {t('activate')}
                        </button>
                      )}
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void showUtilization(c.id)}
                      >
                        {t('utilization')}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => {
                          setAllotmentModal(c);
                          setSelectedContractId(c.id);
                        }}
                      >
                        {t('addAllotment')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={8} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <EraModal
        open={modalOpen}
        title={t('create')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter formId="contract-form" onCancel={() => setModalOpen(false)} busy={busy} submitLabel={t('create')} />
        }
      >
        <form id="contract-form" onSubmit={createContract} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('code')}</label>
            <input className={MODAL_INPUT_CLASS} value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('name')}</label>
            <input className={MODAL_INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('agency')}</label>
            <select className={MODAL_INPUT_CLASS} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('ratePlan')}</label>
            <select className={MODAL_INPUT_CLASS} value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)} required>
              {ratePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('validFrom')}</label>
              <input type="date" className={MODAL_INPUT_CLASS} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('validTo')}</label>
              <input type="date" className={MODAL_INPUT_CLASS} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
        </form>
      </EraModal>

      <EraModal
        open={!!allotmentModal}
        title={t('addAllotment')}
        onClose={() => setAllotmentModal(null)}
        footer={
          <EraModalFooter
            formId="allotment-form"
            onCancel={() => setAllotmentModal(null)}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <form id="allotment-form" onSubmit={addAllotment} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('roomType')}</label>
            <select className={MODAL_INPUT_CLASS} value={allotRoomTypeId} onChange={(e) => setAllotRoomTypeId(e.target.value)}>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('validFrom')}</label>
              <input type="date" className={MODAL_INPUT_CLASS} value={allotFrom} onChange={(e) => setAllotFrom(e.target.value)} required />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('validTo')}</label>
              <input type="date" className={MODAL_INPUT_CLASS} value={allotTo} onChange={(e) => setAllotTo(e.target.value)} required />
            </div>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('nightlyQuota')}</label>
            <input type="number" min={1} className={MODAL_INPUT_CLASS} value={allotQuota} onChange={(e) => setAllotQuota(e.target.value)} required />
          </div>
          {selectedContractId && (
            <p className="text-xs text-[#7F8C8D]">{t('contractHint', { id: selectedContractId.slice(0, 8) })}</p>
          )}
        </form>
      </EraModal>

      <EraModal
        open={!!utilizationModal}
        title={t('utilizationTitle', { code: utilizationModal?.code ?? '' })}
        onClose={() => setUtilizationModal(null)}
        footer={
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setUtilizationModal(null)}>
            {tc('close')}
          </button>
        }
      >
        {utilizationModal && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-[#7F8C8D]">{t('reservationCount')}</dt>
            <dd>{utilizationModal.reservationCount}</dd>
            <dt className="text-[#7F8C8D]">{t('allotmentNights')}</dt>
            <dd>{utilizationModal.allotmentNights}</dd>
            <dt className="text-[#7F8C8D]">{t('consumedNights')}</dt>
            <dd>{utilizationModal.consumedNights}</dd>
            <dt className="text-[#7F8C8D]">{t('utilizationPercent')}</dt>
            <dd>
              {utilizationModal.utilizationPercent != null
                ? `${utilizationModal.utilizationPercent}%`
                : '—'}
            </dd>
            <dt className="text-[#7F8C8D]">{t('totalRevenue')}</dt>
            <dd>{utilizationModal.totalRevenue} AZN</dd>
          </dl>
        )}
      </EraModal>
    </AppShell>
  );
}
