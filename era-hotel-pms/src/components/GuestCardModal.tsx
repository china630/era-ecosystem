'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MODAL_FULL_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import { GuestCardLeftPanel } from '@/components/guest-card/GuestCardLeftPanel';
import { GuestCardIdentityTab } from '@/components/guest-card/GuestCardIdentityTab';
import { GuestCardLoyaltyTab } from '@/components/guest-card/GuestCardLoyaltyTab';
import { GuestCardActionGrid } from '@/components/guest-card/GuestCardActionGrid';
import { GuestCardActions } from '@/components/guest-card/GuestCardActions';
import { GuestCardCrmDialog } from '@/components/guest-card/GuestCardCrmDialog';
import { crmTabButtons, reservationDetailsButtons } from '@/lib/guest-crm-config';
import { GuestCardIdReaderModal, type IdReaderPayload } from '@/components/guest-card/GuestCardIdReaderModal';
import { guestComposedFullName, splitStoredFullName } from '@/lib/guest-identity.shared';
import { guestIdentityGaps, type IdentityField } from '@/lib/guest-stay-requirements';
import { pickPrimaryContact, pickPrimaryDocument } from '@/lib/guest-card-primary';
import type { GuestStats, GuestTabId } from '@/components/guest-card/types';

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

const DETAIL_FIELD_KEYS = [
  'birthDate',
  'birthPlace',
  'occupation',
  'visaType',
  'visaNumber',
  'visaExpiry',
  'maritalStatus',
  'parentFatherName',
  'parentMotherName',
  'verificationStatus',
  'registrationNumber',
  'vehiclePlate',
  'hotelName',
  'voen',
  'marriageDate',
  'bonusPercent',
] as const;

export default function GuestCardModal({
  open,
  guestId,
  onClose,
  onCreated,
  onSaved,
  openIdReaderOnOpen = false,
}: {
  open: boolean;
  guestId: string | null;
  onClose: () => void;
  onCreated?: (
    guestId: string,
    meta?: { fullName: string; firstName: string; lastName: string },
  ) => void;
  /** Fired after successful PATCH of an existing guest. */
  onSaved?: (guestId: string) => void;
  /** Open ID reader stub when the modal opens (Scan ID from reservation party row). */
  openIdReaderOnOpen?: boolean;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<GuestTabId>('identity');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<GuestStats | null>(null);

  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [title, setTitle] = useState('');
  const [sex, setSex] = useState('');
  const [nationality, setNationality] = useState('AZ');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vipType, setVipType] = useState('');
  const [greyList, setGreyList] = useState(false);
  const [problematic, setProblematic] = useState(false);
  const [gdprConfirmed, setGdprConfirmed] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [callBack, setCallBack] = useState(false);
  const [detailFields, setDetailFields] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<
    Array<{
      id: string;
      docType: string;
      docNumber: string;
      serialNo?: string | null;
      issuingAuthority?: string | null;
      nationality?: string | null;
      issuePlace?: string | null;
      isPrimary?: boolean;
    }>
  >([]);
  const [contacts, setContacts] = useState<
    Array<{ id: string; kind: string; value: string; isPrimary?: boolean }>
  >([]);
  const [addresses, setAddresses] = useState<Array<{ id: string; kind: string; line1: string }>>([]);
  const [loyaltyTier, setLoyaltyTier] = useState('');
  const [loyaltyCards, setLoyaltyCards] = useState<
    Array<{ id: string; cardNumber: string; tier: string | null; points: number | null; active: boolean }>
  >([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState<
    Array<{
      id: string;
      entryDate: string;
      points: number;
      description?: string | null;
      balanceAfter?: number | null;
    }>
  >([]);
  const [isLocked, setIsLocked] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [idReaderOpen, setIdReaderOpen] = useState(false);
  const [crmPanel, setCrmPanel] = useState<string | null>(null);
  const [crmBadges, setCrmBadges] = useState<{ specialNotes: number; allergens: number }>({
    specialNotes: 0,
    allergens: 0,
  });
  const [globalPersonId, setGlobalPersonId] = useState<string | null>(null);
  const [transientIdentity, setTransientIdentity] = useState({
    nationalIdFin: '',
    passportNumber: '',
  });
  const [mdmProfile, setMdmProfile] = useState<{
    identifiers: Array<{ type: string; maskedValue: string; isPrimary: boolean }>;
    accessDenied?: boolean;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isCreate = open && !guestId;

  const loadAux = useCallback(async (id: string) => {
    const [docRes, conRes, addrRes, loyRes, ptsRes] = await Promise.all([
      fetch(`/api/guests/${id}/documents`),
      fetch(`/api/guests/${id}/contacts`),
      fetch(`/api/guests/${id}/addresses`),
      fetch(`/api/guests/${id}/loyalty`),
      fetch(`/api/guests/${id}/loyalty/points`),
    ]);
    if (docRes.ok) setDocuments(await docRes.json());
    if (conRes.ok) setContacts(await conRes.json());
    if (addrRes.ok) setAddresses(await addrRes.json());
    if (loyRes.ok) {
      const loy = await loyRes.json();
      setLoyaltyTier(String(loy.loyaltyTier ?? ''));
      setLoyaltyCards(Array.isArray(loy.cards) ? loy.cards : []);
    }
    if (ptsRes.ok) setLoyaltyPoints(await ptsRes.json());
  }, []);

  const load = useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/full`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      const g = json.guest as Record<string, unknown>;
      setStats(json.stats as GuestStats);
      const storedFull = String(g.fullName ?? '');
      let first = String(g.firstName ?? '');
      let middle = String(g.middleName ?? '');
      let last = String(g.lastName ?? '');
      if (!first && !middle && !last && storedFull) {
        const split = splitStoredFullName(storedFull);
        first = split.firstName;
        middle = split.middleName;
        last = split.lastName;
      }
      setFullName(guestComposedFullName({ firstName: first, middleName: middle, lastName: last, fullName: storedFull }));
      setFirstName(first);
      setLastName(last);
      setMiddleName(middle);
      setTitle(String(g.title ?? ''));
      setSex(String(g.sex ?? ''));
      setNationality(String(g.nationality ?? 'AZ'));
      setPhone(String(g.phone ?? ''));
      setEmail(String(g.email ?? ''));
      setVipType(String(g.vipType ?? ''));
      setGreyList(Boolean(g.greyList));
      setProblematic(Boolean(g.problematic));
      setGdprConfirmed(Boolean(g.gdprConfirmed));
      setSmsConsent(Boolean(g.smsConsent));
      setWhatsappConsent(Boolean(g.whatsappConsent));
      setPhoneConsent(Boolean(g.phoneConsent));
      setEmailConsent(Boolean(g.emailConsent));
      setCallBack(Boolean(g.callBack));
      setIsLocked(Boolean(g.isLocked));
      setPhoneVerified(Boolean(g.phoneVerified));
      setEmailVerified(Boolean(g.emailVerified));
      setGlobalPersonId(g.globalPersonId ? String(g.globalPersonId) : null);
      setTransientIdentity({ nationalIdFin: '', passportNumber: '' });
      setMdmProfile(
        json.mdmProfile && typeof json.mdmProfile === 'object'
          ? (json.mdmProfile as typeof mdmProfile)
          : null,
      );
      setDetailFields({
        phone: String(g.phone ?? ''),
        email: String(g.email ?? ''),
        birthDate: g.birthDate ? String(g.birthDate).slice(0, 10) : '',
        birthPlace: String(g.birthPlace ?? ''),
        occupation: String(g.occupation ?? ''),
        visaType: String(g.visaType ?? ''),
        visaNumber: String(g.visaNumber ?? ''),
        visaExpiry: g.visaExpiry ? String(g.visaExpiry).slice(0, 10) : '',
        maritalStatus: String(g.maritalStatus ?? ''),
        parentFatherName: String(g.parentFatherName ?? ''),
        parentMotherName: String(g.parentMotherName ?? ''),
        verificationStatus: String(g.verificationStatus ?? ''),
        registrationNumber: String(g.registrationNumber ?? ''),
        vehiclePlate: String(g.vehiclePlate ?? ''),
        hotelName: String(g.hotelName ?? ''),
        voen: String(g.voen ?? ''),
        marriageDate: g.marriageDate ? String(g.marriageDate).slice(0, 10) : '',
        bonusPercent: g.bonusPercent != null ? String(g.bonusPercent) : '',
      });
      const pid = g.globalPersonId ? String(g.globalPersonId) : null;
      if (pid && !json.mdmProfile) {
        setProfileLoading(true);
        void fetch(`/api/mdm/person-ops-profile?globalPersonId=${encodeURIComponent(pid)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((p) => setMdmProfile(p))
          .finally(() => setProfileLoading(false));
      }
      await loadAux(guestId);
      const badgeRes = await fetch(`/api/guests/${guestId}/crm-badges`);
      if (badgeRes.ok) {
        const b = await badgeRes.json();
        setCrmBadges({
          specialNotes: Number(b.specialNotes ?? 0),
          allergens: Number(b.allergens ?? 0),
        });
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [guestId, tc, loadAux]);

  useEffect(() => {
    if (!open) return;
    if (!guestId) {
      setLoading(false);
      setStats(null);
      setTab('identity');
      setGlobalPersonId(null);
      setTransientIdentity({ nationalIdFin: '', passportNumber: '' });
      setMdmProfile(null);
      return;
    }
    void load();
  }, [open, guestId, load]);

  useEffect(() => {
    if (!open) {
      setIdReaderOpen(false);
      return;
    }
    if (!openIdReaderOnOpen) return;
    setIdReaderOpen(true);
  }, [open, openIdReaderOnOpen, guestId]);

  const crmActions = crmTabButtons(guestId, crmBadges);
  const resActions = reservationDetailsButtons(guestId, crmBadges);

  function handleLeftPanelChange(patch: Record<string, string | boolean>) {
    if ('firstName' in patch || 'middleName' in patch || 'lastName' in patch) {
      const nextFirst = 'firstName' in patch ? String(patch.firstName) : firstName;
      const nextMiddle = 'middleName' in patch ? String(patch.middleName) : middleName;
      const nextLast = 'lastName' in patch ? String(patch.lastName) : lastName;
      setFirstName(nextFirst);
      setMiddleName(nextMiddle);
      setLastName(nextLast);
      const composed = guestComposedFullName({
        firstName: nextFirst,
        middleName: nextMiddle,
        lastName: nextLast,
      });
      if (composed) setFullName(composed);
    }
    if ('title' in patch) setTitle(String(patch.title));
    if ('sex' in patch) setSex(String(patch.sex));
    if ('nationality' in patch) setNationality(String(patch.nationality));
    if ('vipType' in patch) setVipType(String(patch.vipType));
    if ('loyaltyTier' in patch) setLoyaltyTier(String(patch.loyaltyTier));
    if ('greyList' in patch) setGreyList(Boolean(patch.greyList));
    if ('problematic' in patch) setProblematic(Boolean(patch.problematic));
    if ('phone' in patch) {
      const v = String(patch.phone);
      setPhone(v);
      setDetailFields((f) => ({ ...f, phone: v }));
    }
    if ('email' in patch) {
      const v = String(patch.email);
      setEmail(v);
      setDetailFields((f) => ({ ...f, email: v }));
    }
    const detailPatch: Record<string, string> = {};
    for (const key of DETAIL_FIELD_KEYS) {
      if (key in patch) detailPatch[key] = String(patch[key]);
    }
    if (Object.keys(detailPatch).length > 0) {
      setDetailFields((f) => ({ ...f, ...detailPatch }));
    }
  }

  function identityLabel(field: IdentityField): string {
    if (field === 'firstName') return t('fields.firstName');
    if (field === 'lastName') return t('fields.lastName');
    if (field === 'sex') return t('fields.gender');
    if (field === 'birthDate') return t('details.birthDate');
    return t('fields.nationality');
  }

  function rejectIncompleteIdentity(): boolean {
    const gaps = guestIdentityGaps({
      firstName,
      lastName,
      sex,
      birthDate: detailFields.birthDate,
      nationality,
    });
    if (gaps.length === 0) return false;
    showApiError({
      error: t('identityMissing', { fields: gaps.map(identityLabel).join(', ') }),
    });
    return true;
  }

  async function saveCreate() {
    if (rejectIncompleteIdentity()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName:
            guestComposedFullName({ firstName, middleName, lastName, fullName }) ||
            fullName.trim(),
          firstName: firstName || null,
          middleName: middleName || null,
          lastName: lastName || null,
          title: title || null,
          sex: sex || null,
          birthDate: detailFields.birthDate || null,
          nationality,
          phone: phone || null,
          email: email || null,
          vipType: vipType || null,
          nationalIdFin: transientIdentity.nationalIdFin || null,
          passportNumber: transientIdentity.passportNumber || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json);
        return;
      }
      showSuccess(tc('success'));
      if (onCreated && json.id) {
        const full =
          fullName.trim() || `${firstName} ${lastName}`.trim() || String(json.fullName ?? '');
        onCreated(json.id, {
          fullName: full,
          firstName: firstName || String(json.firstName ?? ''),
          lastName: lastName || String(json.lastName ?? ''),
        });
        onClose();
      } else {
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!guestId) {
      await saveCreate();
      return;
    }
    if (rejectIncompleteIdentity()) return;
    setBusy(true);
    try {
      const composed = guestComposedFullName({ firstName, middleName, lastName, fullName });
      const phoneFromList = pickPrimaryContact(contacts, ['MOBILE', 'PHONE', 'WHATSAPP']);
      const emailFromList = pickPrimaryContact(contacts, ['EMAIL']);
      const finFromList = pickPrimaryDocument(documents, ['ID_CARD', 'FIN', 'NATIONAL_ID']);
      const passFromList = pickPrimaryDocument(documents, ['PASSPORT']);
      const res = await fetch(`/api/guests/${guestId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: composed || fullName,
          firstName: firstName || null,
          middleName: middleName || null,
          lastName: lastName || null,
          title: title || null,
          sex: sex || null,
          nationality,
          phone: phoneFromList || detailFields.phone || phone || null,
          email: emailFromList || detailFields.email || email || null,
          vipType: vipType || null,
          greyList,
          problematic,
          gdprConfirmed,
          smsConsent,
          whatsappConsent,
          phoneConsent,
          emailConsent,
          callBack,
          birthDate: detailFields.birthDate || null,
          birthPlace: detailFields.birthPlace || null,
          occupation: detailFields.occupation || null,
          nationalIdFin: finFromList || transientIdentity.nationalIdFin || null,
          passportNumber: passFromList || transientIdentity.passportNumber || null,
          visaType: detailFields.visaType || null,
          visaNumber: detailFields.visaNumber || null,
          visaExpiry: detailFields.visaExpiry || null,
          maritalStatus: detailFields.maritalStatus || null,
          parentFatherName: detailFields.parentFatherName || null,
          parentMotherName: detailFields.parentMotherName || null,
          verificationStatus: detailFields.verificationStatus || null,
          registrationNumber: detailFields.registrationNumber || null,
          vehiclePlate: detailFields.vehiclePlate || null,
          hotelName: detailFields.hotelName || null,
          voen: detailFields.voen || null,
          marriageDate: detailFields.marriageDate || null,
          bonusPercent: detailFields.bonusPercent ? Number(detailFields.bonusPercent) : null,
          phoneVerified,
          emailVerified,
          isLocked,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json);
        return;
      }
      showSuccess(tc('success'));
      await load();
      onSaved?.(guestId);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const statItems = [
    { key: 'totalVisit', value: stats?.totalVisit ?? 0 },
    { key: 'totalNights', value: stats?.totalNights ?? 0 },
    { key: 'totalRevenue', value: (stats?.totalRevenue ?? 0).toFixed(2) },
    { key: 'avgRate', value: (stats?.avgRate ?? 0).toFixed(2) },
    { key: 'bonus', value: (stats?.bonus ?? 0).toFixed(2) },
    { key: 'surveys', value: stats?.surveysAverage ?? 0 },
    { key: 'comments', value: stats?.comments ?? 0 },
    { key: 'preferences', value: stats?.preferences ?? 0 },
  ];

  const rightTabs: GuestTabId[] = ['identity', 'crm', 'reservations', 'loyalty'];
  const displayName =
    guestComposedFullName({ firstName, middleName, lastName, fullName }) || fullName;
  const primaryHit =
    documents.find((d) => d.isPrimary && d.docNumber.trim()) ??
    documents.find((d) => d.docNumber.trim());
  const knownDoc = ['PASSPORT', 'ID_CARD', 'FIN', 'VISA', 'OTHER'];
  const primaryDocument = primaryHit
    ? `${knownDoc.includes(primaryHit.docType) ? t(`docType.${primaryHit.docType}` as 'docType.PASSPORT') : primaryHit.docType} ${primaryHit.docNumber.trim()}`
    : '';

  function printCard() {
    const lines = [
      displayName,
      guestId ? guestId.slice(0, 8) : '',
      phone,
      email,
      primaryDocument,
    ].filter(Boolean);
    const popup = window.open('', '_blank', 'noopener,width=720,height=640');
    if (!popup) return;
    const body = lines.map((line) => `<p>${line.replace(/</g, '')}</p>`).join('');
    popup.document.write(`<!doctype html><title>${displayName}</title><body>${body}</body>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <EraModal
      open={open}
      title={isCreate ? t('createTitle') : displayName || t('title')}
      subtitle={guestId ? guestId.slice(0, 8) : undefined}
      onClose={onClose}
      maxWidthClass={`${MODAL_FULL_CLASS} overflow-hidden flex flex-col`}
      bodyClassName="mt-3 min-h-0 flex-1 overflow-hidden flex flex-col"
      headerActions={
        <GuestCardActions
          mode="header"
          busy={busy}
          loading={loading && !isCreate}
          isLocked={isLocked}
          guestId={guestId}
          onCopy={
            guestId
              ? () => {
                  void navigator.clipboard?.writeText(guestId);
                  showSuccess(t('toolbar.copied'));
                }
              : undefined
          }
          onToggleLock={guestId ? () => setIsLocked((v) => !v) : undefined}
          onPrint={printCard}
          onIdReader={() => setIdReaderOpen(true)}
        />
      }
      footer={
        <GuestCardActions mode="footer" busy={busy} loading={loading && !isCreate} onSave={() => void save()} />
      }
    >
      {loading && !isCreate ? (
        <p className="py-8 text-center text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${greyList ? 'bg-slate-700 text-white' : 'bg-[#F4F6F7] text-[#7F8C8D]'}`}
              onClick={() => setGreyList((v) => !v)}
            >
              {t('greyList')}
            </button>
            <button
              type="button"
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${problematic ? 'bg-red-700 text-white' : 'bg-[#F4F6F7] text-[#7F8C8D]'}`}
              onClick={() => setProblematic((v) => !v)}
            >
              {t('problematic')}
            </button>
          </div>
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

          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
            <GuestCardLeftPanel
              fullName={fullName}
              firstName={firstName}
              lastName={lastName}
              middleName={middleName}
              title={title}
              sex={sex}
              nationality={nationality}
              birthDate={detailFields.birthDate ?? ''}
              birthPlace={detailFields.birthPlace ?? ''}
              phone={pickPrimaryContact(contacts, ['MOBILE', 'PHONE', 'WHATSAPP']) || detailFields.phone || phone}
              email={pickPrimaryContact(contacts, ['EMAIL']) || detailFields.email || email}
              vipType={vipType}
              loyaltyTier={loyaltyTier}
              verificationStatus={detailFields.verificationStatus ?? ''}
              phoneVerified={phoneVerified}
              emailVerified={emailVerified}
              voen={detailFields.voen ?? ''}
              visaType={detailFields.visaType ?? ''}
              visaNumber={detailFields.visaNumber ?? ''}
              visaExpiry={detailFields.visaExpiry ?? ''}
              registrationNumber={detailFields.registrationNumber ?? ''}
              vehiclePlate={detailFields.vehiclePlate ?? ''}
              occupation={detailFields.occupation ?? ''}
              maritalStatus={detailFields.maritalStatus ?? ''}
              parentFatherName={detailFields.parentFatherName ?? ''}
              parentMotherName={detailFields.parentMotherName ?? ''}
              marriageDate={detailFields.marriageDate ?? ''}
              bonusPercent={detailFields.bonusPercent ?? ''}
              primaryDocument={primaryDocument}
              transientIdentity={transientIdentity}
              mdmProfile={mdmProfile}
              profileLoading={profileLoading}
              guestId={guestId}
              globalPersonId={globalPersonId}
              allergenCount={crmBadges.allergens}
              onChange={handleLeftPanelChange}
              onTransientChange={(key, value) =>
                setTransientIdentity((f) => ({ ...f, [key]: value }))
              }
              onVerified={(key, value) => {
                if (key === 'phoneVerified') setPhoneVerified(value);
                else setEmailVerified(value);
              }}
              onGlobalPersonIdChange={setGlobalPersonId}
              onReload={() => (guestId ? void load() : undefined)}
            />

            <div className="flex min-h-0 min-w-0 flex-col">
              <div className={TAB_STRIP_CLASS} role="tablist">
                {rightTabs.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
                    onClick={() => setTab(id)}
                  >
                    {
                      {
                        identity: t('tabIdentity'),
                        crm: t('tabCrm'),
                        reservations: t('tabReservations'),
                        loyalty: t('tabLoyalty'),
                        timeshare: t('tabTimeShare'),
                      }[id]
                    }
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pb-2">
                {tab === 'identity' && (
                  <GuestCardIdentityTab
                    guestId={guestId}
                    documents={documents}
                    contacts={contacts}
                    addresses={addresses}
                    gdprConfirmed={gdprConfirmed}
                    smsConsent={smsConsent}
                    whatsappConsent={whatsappConsent}
                    phoneConsent={phoneConsent}
                    emailConsent={emailConsent}
                    callBack={callBack}
                    draftPhone={phone}
                    draftEmail={email}
                    onDraftChange={(patch) => {
                      if (patch.phone != null) {
                        setPhone(patch.phone);
                        setDetailFields((f) => ({ ...f, phone: patch.phone! }));
                      }
                      if (patch.email != null) {
                        setEmail(patch.email);
                        setDetailFields((f) => ({ ...f, email: patch.email! }));
                      }
                    }}
                    onConsent={(key, value) => {
                      const m: Record<string, (v: boolean) => void> = {
                        gdprConfirmed: setGdprConfirmed,
                        smsConsent: setSmsConsent,
                        whatsappConsent: setWhatsappConsent,
                        phoneConsent: setPhoneConsent,
                        emailConsent: setEmailConsent,
                        callBack: setCallBack,
                      };
                      m[key]?.(value);
                    }}
                    onReload={() => (guestId ? void loadAux(guestId) : undefined)}
                  />
                )}
                {tab === 'crm' && (
                  <GuestCardActionGrid actions={crmActions} onOpenPanel={setCrmPanel} />
                )}
                {tab === 'reservations' && (
                  <GuestCardActionGrid actions={resActions} onOpenPanel={setCrmPanel} />
                )}
                {tab === 'loyalty' && (
                  <GuestCardLoyaltyTab
                    loyaltyTier={loyaltyTier}
                    cards={loyaltyCards}
                    pointEntries={loyaltyPoints}
                    guestId={guestId}
                    onReload={() => (guestId ? void loadAux(guestId) : undefined)}
                    onReloadPoints={() =>
                      guestId
                        ? void fetch(`/api/guests/${guestId}/loyalty/points`)
                            .then((r) => r.json())
                            .then((list) => setLoyaltyPoints(Array.isArray(list) ? list : []))
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <GuestCardIdReaderModal
        open={idReaderOpen}
        onClose={() => setIdReaderOpen(false)}
        onApply={(data: IdReaderPayload) => {
          if (data.firstName) setFirstName(data.firstName);
          if (data.lastName) setLastName(data.lastName);
          if (data.fullName) setFullName(data.fullName);
          if (data.nationality) setNationality(data.nationality);
          if (data.gender) setSex(data.gender);
          if (data.sex) setSex(data.sex);
          setTransientIdentity((f) => ({
            ...f,
            passportNumber: data.passportNumber ?? f.passportNumber,
            nationalIdFin: data.nationalIdFin ?? f.nationalIdFin,
          }));
          setDetailFields((f) => ({
            ...f,
            birthDate: data.birthDate ?? f.birthDate,
          }));
          showSuccess(t('idReaderApplied'));
          if (guestId && data.passportNumber) {
            void fetch(`/api/guests/${guestId}/documents`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                docType: 'PASSPORT',
                docNumber: data.passportNumber,
                isPrimary: true,
              }),
            }).then(() => void loadAux(guestId));
          }
          if (guestId && data.nationalIdFin) {
            void fetch(`/api/guests/${guestId}/documents`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                docType: 'FIN',
                docNumber: data.nationalIdFin,
                isPrimary: !data.passportNumber,
              }),
            }).then(() => void loadAux(guestId));
          }
        }}
      />
      <GuestCardCrmDialog panelId={crmPanel} guestId={guestId} onClose={() => setCrmPanel(null)} />
    </EraModal>
  );
}
