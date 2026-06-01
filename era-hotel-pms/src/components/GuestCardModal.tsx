'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraDataGrid,
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import { GuestCardToolbar } from '@/components/GuestCardToolbar';

type Stats = {
  totalVisit: number;
  totalNights: number;
  totalRevenue: number;
  avgRate: number;
  bonus: number;
  surveysAverage: number;
  comments: number;
  preferences: number;
};

type TabId = 'identity' | 'crm' | 'reservations' | 'details' | 'loyalty' | 'timeshare';

const STAT_COLORS = [
  'text-amber-600',
  'text-[#2980B9]',
  'text-emerald-600',
  'text-violet-600',
  'text-orange-600',
  'text-pink-600',
  'text-[#7F8C8D]',
  'text-indigo-600',
];

export default function GuestCardModal({
  open,
  guestId,
  onClose,
  onCreated,
}: {
  open: boolean;
  guestId: string | null;
  onClose: () => void;
  /** After create (no guestId), return new guest id to parent (e.g. booking form). */
  onCreated?: (guestId: string) => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<TabId>('identity');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('AZ');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vipType, setVipType] = useState('');
  const [greyList, setGreyList] = useState(false);
  const [problematic, setProblematic] = useState(false);
  const [gdprConfirmed, setGdprConfirmed] = useState(false);
  const [documents, setDocuments] = useState<Array<{ id: string; docType: string; docNumber: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; kind: string; value: string }>>([]);
  const [addresses, setAddresses] = useState<Array<{ id: string; kind: string; line1: string }>>([]);
  const [loyalty, setLoyalty] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/full`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      const g = json.guest as Record<string, unknown>;
      setStats(json.stats as Stats);
      setFullName(String(g.fullName ?? ''));
      setFirstName(String(g.firstName ?? ''));
      setLastName(String(g.lastName ?? ''));
      setTitle(String(g.title ?? ''));
      setGender(String(g.gender ?? ''));
      setNationality(String(g.nationality ?? 'AZ'));
      setPhone(String(g.phone ?? ''));
      setEmail(String(g.email ?? ''));
      setVipType(String(g.vipType ?? ''));
      setGreyList(Boolean(g.greyList));
      setProblematic(Boolean(g.problematic));
      setGdprConfirmed(Boolean(g.gdprConfirmed));
      const [docRes, conRes, addrRes, loyRes] = await Promise.all([
        fetch(`/api/guests/${guestId}/documents`),
        fetch(`/api/guests/${guestId}/contacts`),
        fetch(`/api/guests/${guestId}/addresses`),
        fetch(`/api/guests/${guestId}/loyalty`),
      ]);
      if (docRes.ok) setDocuments(await docRes.json());
      if (conRes.ok) setContacts(await conRes.json());
      if (addrRes.ok) setAddresses(await addrRes.json());
      if (loyRes.ok) setLoyalty(await loyRes.json());
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [guestId, tc]);

  const isCreate = open && !guestId;

  useEffect(() => {
    if (!open) return;
    if (!guestId) {
      setLoading(false);
      setStats(null);
      setFullName('');
      setFirstName('');
      setLastName('');
      setTitle('');
      setGender('');
      setNationality('AZ');
      setPhone('');
      setEmail('');
      setVipType('');
      setGreyList(false);
      setProblematic(false);
      setGdprConfirmed(false);
      setDocuments([]);
      setContacts([]);
      setAddresses([]);
      setLoyalty(null);
      setTab('identity');
      return;
    }
    void load();
  }, [open, guestId, load]);

  async function saveCreate() {
    setBusy(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim() || `${firstName} ${lastName}`.trim(),
          firstName: firstName || null,
          lastName: lastName || null,
          nationality,
          phone: phone || null,
          email: email || null,
          vipType: vipType || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json);
        return;
      }
      showSuccess(tc('success'));
      if (onCreated && json.id) {
        onCreated(json.id);
        onClose();
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!guestId) {
      await saveCreate();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          firstName: firstName || null,
          lastName: lastName || null,
          title: title || null,
          gender: gender || null,
          nationality,
          phone: phone || null,
          email: email || null,
          vipType: vipType || null,
          greyList,
          problematic,
          gdprConfirmed,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json);
        return;
      }
      showSuccess(tc('success'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const statItems =
    !isCreate && stats
      ? [
        { key: 'totalVisit', value: stats.totalVisit },
        { key: 'totalNights', value: stats.totalNights },
        { key: 'totalRevenue', value: stats.totalRevenue.toFixed(2) },
        { key: 'avgRate', value: stats.avgRate.toFixed(2) },
        { key: 'bonus', value: stats.bonus.toFixed(2) },
        { key: 'surveys', value: stats.surveysAverage },
        { key: 'comments', value: stats.comments },
        { key: 'preferences', value: stats.preferences },
      ]
      : [];

  const crmActions: { href?: string; labelKey: string; disabled?: boolean }[] = [
    { labelKey: 'crm.tasks', disabled: true },
    { labelKey: 'crm.preferences', disabled: true },
    { labelKey: 'crm.allergens', disabled: true },
    { labelKey: 'crm.interests', disabled: true },
    { href: '/procedures', labelKey: 'crm.facilityReservations' },
    { labelKey: 'crm.specialDates', disabled: true },
    { labelKey: 'crm.notes', disabled: true },
    { href: '/medical', labelKey: 'crm.healthInfo' },
    { href: '/medical', labelKey: 'crm.medicalHistory' },
    { href: '/procedures', labelKey: 'crm.procedures' },
    { labelKey: 'crm.labTests', disabled: true },
    { href: '/transfers', labelKey: 'crm.transfers' },
    { labelKey: 'crm.comments', disabled: true },
    { href: '/guests', labelKey: 'crm.guestRegistry' },
  ];

  const resActions: { href?: string; labelKey: string; disabled?: boolean }[] = [
    { href: '/reports/reservations', labelKey: 'resDetail.reservations' },
    { href: '/in-house', labelKey: 'resDetail.inHouse' },
    { href: '/reports/group-reservations', labelKey: 'resDetail.groups' },
    { href: '/transfers', labelKey: 'resDetail.transfers' },
    { labelKey: 'resDetail.folio', disabled: true },
  ];

  const docColumns = [
    { key: 'docType', header: t('grid.type') },
    { key: 'docNumber', header: t('grid.number') },
  ];
  const contactColumns = [
    { key: 'kind', header: t('grid.type') },
    { key: 'value', header: t('grid.contact') },
  ];
  const addressColumns = [
    { key: 'kind', header: t('grid.type') },
    { key: 'line1', header: t('grid.address') },
  ];

  return (
    <EraModal
      open={open}
      title={t('title')}
      onClose={onClose}
      maxWidthClass="max-w-[min(96vw,1400px)] w-full max-h-[92vh] overflow-hidden flex flex-col"
      footer={null}
    >
      <GuestCardToolbar
        subtitle={isCreate ? t('createTitle') : fullName || t('title')}
        busy={busy}
        loading={loading && !isCreate}
        onClose={onClose}
        onSave={() => void save()}
      />
      {loading && !isCreate ? (
        <p className="py-8 text-center text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <>
          {statItems.length > 0 ? (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {statItems.map((s, i) => (
              <div
                key={s.key}
                className="rounded-lg border border-[#D5DADF] bg-white p-2 text-center shadow-sm"
              >
                <p className={`text-[10px] font-medium uppercase ${STAT_COLORS[i % STAT_COLORS.length]}`}>
                  {t(`stats.${s.key}` as 'stats.totalVisit')}
                </p>
                <p className="text-lg font-bold text-[#34495E]">{s.value}</p>
              </div>
            ))}
          </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(260px,30%)_1fr]">
            <aside className="space-y-3 border-r border-[#D5DADF] pr-3">
              <button type="button" className={`${PRIMARY_BUTTON_CLASS} w-full`} disabled>
                {t('idReader')}
              </button>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('fields.fullName')}</label>
                <input className={MODAL_INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('fields.firstName')}</label>
                <input className={MODAL_INPUT_CLASS} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('fields.lastName')}</label>
                <input className={MODAL_INPUT_CLASS} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('fields.nationality')}</label>
                <input className={MODAL_INPUT_CLASS} value={nationality} onChange={(e) => setNationality(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('fields.vipType')}</label>
                <input className={MODAL_INPUT_CLASS} value={vipType} onChange={(e) => setVipType(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={greyList} onChange={(e) => setGreyList(e.target.checked)} />
                {t('greyList')}
              </label>
              <label className="flex items-center gap-2 text-[13px] text-red-700">
                <input type="checkbox" checked={problematic} onChange={(e) => setProblematic(e.target.checked)} />
                {t('problematic')}
              </label>
            </aside>

            <div>
              <div className="mb-2 flex flex-wrap gap-1 border-b border-[#D5DADF]">
                {(['identity', 'crm', 'reservations', 'details', 'loyalty', 'timeshare'] as TabId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`px-2 py-1.5 text-[12px] ${tab === id ? 'border-b-2 border-[#2980B9] text-[#2980B9]' : 'text-[#7F8C8D]'}`}
                    onClick={() => setTab(id)}
                  >
                    {
                      {
                        identity: t('tabIdentity'),
                        crm: t('tabCrm'),
                        reservations: t('tabReservations'),
                        details: t('tabDetails'),
                        loyalty: t('tabLoyalty'),
                        timeshare: t('tabTimeShare'),
                      }[id]
                    }
                  </button>
                ))}
              </div>

              {tab === 'identity' && (
                <div className="space-y-4 text-[13px]">
                  <div>
                    <h3 className="mb-2 font-semibold text-[#34495E]">{t('documents')}</h3>
                    <EraDataGrid
                      rows={documents as Array<Record<string, unknown>>}
                      columns={docColumns}
                      rowKey={(r) => String(r.id)}
                      emptyMessage="—"
                    />
                    <button
                      type="button"
                      className="mt-2 text-[12px] font-medium text-[#2980B9]"
                      onClick={async () => {
                        const docType = window.prompt(t('grid.type'), 'PASSPORT');
                        const docNumber = window.prompt(t('grid.number'));
                        if (!docType || !docNumber || !guestId) return;
                        await fetch(`/api/guests/${guestId}/documents`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ docType, docNumber }),
                        });
                        await load();
                      }}
                    >
                      + {t('addDocument')}
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 font-semibold text-[#34495E]">{t('contacts')}</h3>
                      <EraDataGrid
                        rows={contacts as Array<Record<string, unknown>>}
                        columns={contactColumns}
                        rowKey={(r) => String(r.id)}
                        emptyMessage="—"
                      />
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold text-[#34495E]">{t('addresses')}</h3>
                      <EraDataGrid
                        rows={addresses as Array<Record<string, unknown>>}
                        columns={addressColumns}
                        rowKey={(r) => String(r.id)}
                        emptyMessage="—"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 border-t border-[#D5DADF] pt-3">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={gdprConfirmed} onChange={(e) => setGdprConfirmed(e.target.checked)} />
                      {t('consent.gdpr')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" disabled />
                      {t('consent.sms')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" disabled />
                      {t('consent.whatsapp')}
                    </label>
                  </div>
                </div>
              )}

              {tab === 'crm' && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {crmActions.map((a) =>
                    a.href && !a.disabled ? (
                      <Link
                        key={a.labelKey}
                        href={a.href}
                        className="rounded-lg bg-[#2980B9] px-3 py-3 text-center text-[13px] font-medium text-white hover:bg-[#2471A3]"
                      >
                        {t(a.labelKey as 'crm.tasks')}
                      </Link>
                    ) : (
                      <span
                        key={a.labelKey}
                        className="rounded-lg bg-[#2980B9]/40 px-3 py-3 text-center text-[13px] text-white/90"
                        title={t('comingSoon')}
                      >
                        {t(a.labelKey as 'crm.tasks')}
                      </span>
                    ),
                  )}
                </div>
              )}

              {tab === 'reservations' && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {resActions.map((a) =>
                    a.href && !('disabled' in a && a.disabled) ? (
                      <Link
                        key={a.labelKey}
                        href={a.href}
                        className="rounded-lg bg-[#2980B9] px-3 py-3 text-center text-[13px] font-medium text-white hover:bg-[#2471A3]"
                      >
                        {t(a.labelKey as 'resDetail.reservations')}
                      </Link>
                    ) : (
                      <span
                        key={a.labelKey}
                        className="rounded-lg bg-[#2980B9]/40 px-3 py-3 text-center text-[13px] text-white/90"
                      >
                        {t(a.labelKey as 'resDetail.reservations')}
                      </span>
                    ),
                  )}
                </div>
              )}

              {tab === 'details' && (
                <div className="grid gap-3 sm:grid-cols-2 text-[13px] text-[#34495E]">
                  <p>{t('details.phone')}: {phone || '—'}</p>
                  <p>{t('details.email')}: {email || '—'}</p>
                  <p className="sm:col-span-2 text-[12px] text-[#7F8C8D]">{t('details.accountingHint')}</p>
                </div>
              )}
              {tab === 'loyalty' && (
                <pre className="overflow-auto rounded bg-[#F8FAFC] p-2 text-[11px]">
                  {loyalty ? JSON.stringify(loyalty, null, 2) : t('comingSoon')}
                </pre>
              )}
              {tab === 'timeshare' && <p className="text-[13px] text-[#7F8C8D]">{t('comingSoon')}</p>}
            </div>
          </div>
        </>
      )}
    </EraModal>
  );
}
