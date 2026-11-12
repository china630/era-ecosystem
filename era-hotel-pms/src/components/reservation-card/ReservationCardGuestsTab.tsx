'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightLeft, Camera, LogOut, Search, Smartphone, Star, Stethoscope, Trash2, UserPlus } from 'lucide-react';
import { GuestAppLinkModal } from '@/components/reservation-card/GuestAppLinkModal';
import { MrzLiveFrame } from '@/components/mrz/MrzLiveFrame';
import {
  CatalogField,
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
  showWarning,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { guestListItems } from '@/lib/guest-list-identity';
import { useHotelLookupOptions, withOrphanOption } from '@/lib/hotel-lookups';
import {
  ageYearsFromBirthDate,
  guestFitsSlot,
  isMinorPax,
  splitFullName,
} from '@/components/reservation-card/party-pax';
import type { PartyBillingMode, PaxRow, SelectOption } from './types';

export { emptyPax } from '@/components/reservation-card/party-pax';

function guestHits(list: unknown): SelectOption[] {
  return guestListItems(list).map((x) => ({ ...x, label: x.fullName }));
}

function withGuestDemographics(row: PaxRow, g: SelectOption): PaxRow {
  const named =
    g.firstName || g.lastName
      ? { firstName: g.firstName ?? '', lastName: g.lastName ?? '' }
      : splitFullName(g.label);
  const birthDate = g.birthDate || row.birthDate;
  return {
    ...row,
    guestId: g.id,
    firstName: named.firstName || row.firstName,
    lastName: named.lastName || row.lastName,
    sex: g.sex || row.sex,
    nationality: g.nationality || row.nationality,
    birthDate,
    age: birthDate ? ageYearsFromBirthDate(birthDate) : row.age,
    passportNo: g.passportNo || row.passportNo,
    idCardNo: g.idCardNo || row.idCardNo,
  };
}

type PaxGridRow = PaxRow & Record<string, unknown> & { _idx: number };

/**
 * Compact party list (HOT-BOOK-06): role · name link · docs · DOB/age · medical badge · status · ⋮.
 */
export function ReservationCardGuestsTab({
  reservationId = null,
  guestOptions,
  pax,
  partyBillingMode,
  onPartyBillingMode,
  onGuestId,
  onPax,
  onNewGuest,
  packageOptions = [],
  showMedicalPackages = false,
  onOpenGuestCard,
  onScanId,
  preferredBed = '',
  preferredLocation = '',
  voucherNo = '',
  allergenCount = 0,
  vipType = '',
  tripReason = '',
  onVipType,
  onTripReason,
  partyOpsEnabled = false,
  onDepartGuest,
  onMoveGuest,
  clinicAdmitEnabled = false,
  onClinicAdmit,
}: {
  reservationId?: string | null;
  isCreate?: boolean;
  guestId: string;
  guestOptions: SelectOption[];
  pax: PaxRow[];
  partyBillingMode: PartyBillingMode;
  onPartyBillingMode: (mode: PartyBillingMode) => void;
  onGuestId: (id: string) => void;
  onPax: (rows: PaxRow[]) => void;
  /** Create a guest card into this empty row. */
  onNewGuest: (paxIndex: number) => void;
  /** Medical SKUs for a named guest. Shown only on a medical tariff. */
  packageOptions?: Array<{ value: string; label: string }>;
  showMedicalPackages?: boolean;
  onRepeatGuest?: () => void;
  /** Open existing guest profile (name click). */
  onOpenGuestCard?: (guestId: string) => void;
  /** Open guest card with the ID reader. paxIndex is the row that should receive a new guest. */
  onScanId?: (guestId: string | null, paxIndex?: number) => void;
  preferredBed?: string;
  preferredLocation?: string;
  voucherNo?: string;
  allergenCount?: number;
  vipType?: string;
  tripReason?: string;
  onVipType?: (v: string) => void;
  onTripReason?: (v: string) => void;
  partyOpsEnabled?: boolean;
  onDepartGuest?: (paxIndex: number) => void;
  onMoveGuest?: (paxIndex: number) => void;
  /** Saved stay, not yet in house. */
  clinicAdmitEnabled?: boolean;
  onClinicAdmit?: (paxIndex: number) => void;
}) {
  const t = useTranslations('reservationCard');
  const [linkPaxId, setLinkPaxId] = useState<string | null>(null);
  const [mrzIdx, setMrzIdx] = useState<number | null>(null);
  const [questionnaireHint, setQuestionnaireHint] = useState<string | null>(null);
  const [familyGrants, setFamilyGrants] = useState<
    Array<{ id: string; grantorGuestId: string; granteeGuestId: string; deskConfirmed: boolean }>
  >([]);
  const [stayOrders, setStayOrders] = useState<
    Array<{ id: string; kind: string; status: string; note: string | null }>
  >([]);
  const [msgPaxId, setMsgPaxId] = useState<string>('');
  const [msgKind, setMsgKind] = useState<'RECEPTION' | 'CLINIC' | 'MARKETING'>('RECEPTION');
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgHint, setMsgHint] = useState<string | null>(null);
  const { byKind } = useHotelLookupOptions(['VIP_TYPE', 'TRIP_REASON']);
  const [menuOpenIdx, setMenuOpenIdx] = useState<number | null>(null);
  const [removeIdx, setRemoveIdx] = useState<number | null>(null);
  const [rowEdit, setRowEdit] = useState<number | null>(null);
  const [rowQuery, setRowQuery] = useState('');
  const [rowHits, setRowHits] = useState<SelectOption[]>([]);
  const [starConfirm, setStarConfirm] = useState<null | { index: number; kind: 'make' | 'clear' }>(
    null,
  );

  useEffect(() => {
    if (!reservationId) {
      setQuestionnaireHint(null);
      setFamilyGrants([]);
      setStayOrders([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/guest-app/reservations/${reservationId}/questionnaire`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          items: Array<{ complete: boolean; gaps: string[] }>;
        };
        const incomplete = data.items.filter((row) => !row.complete).length;
        setQuestionnaireHint(
          incomplete === 0 ? t('questionnaireComplete') : t('questionnaireGaps', { count: incomplete }),
        );
      })
      .catch(() => undefined);
    void fetch(`/api/guest-app/reservations/${reservationId}/family-grants`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items: typeof familyGrants };
        setFamilyGrants(data.items);
      })
      .catch(() => undefined);
    void fetch(`/api/guest-app/reservations/${reservationId}/orders`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items: typeof stayOrders };
        setStayOrders(data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reservationId, pax, t]);

  const equalMode = partyBillingMode === 'EQUAL';

  const hasPartyMembers = pax.some(
    (p) => Boolean(p.guestId) || Boolean(p.firstName.trim()) || Boolean(p.lastName.trim()),
  );

  useEffect(() => {
    if (rowEdit == null) return;
    const q = rowQuery.trim();
    if (q.length < 2) {
      setRowHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/guests?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((list) => setRowHits(guestHits(list)))
        .catch(() => setRowHits([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [rowQuery, rowEdit]);

  function setPrimaryAt(index: number) {
    if (equalMode) return;
    const row = pax[index];
    if (!row) return;
    onPax(
      pax.map((p, j) => ({
        ...p,
        isPrimary: j === index,
        ownsFolio: true,
      })),
    );
    if (row.guestId) onGuestId(row.guestId);
  }

  function removeAt(index: number) {
    const row = pax[index];
    const next = pax.filter((_, j) => j !== index);
    if (row?.isPrimary && next.length > 0) {
      next[0] = {
        ...next[0],
        isPrimary: true,
        ownsFolio: true,
      };
      for (let i = 1; i < next.length; i++) next[i] = { ...next[i], ownsFolio: true };
      if (next[0].guestId) onGuestId(next[0].guestId);
      else onGuestId('');
    } else if (next.length === 0) {
      onGuestId('');
    }
    onPax(next);
  }

  function assignGuestAt(index: number, g: SelectOption) {
    const slot = pax[index];
    if (!slot) return;
    if (pax.some((row, i) => i !== index && row.guestId === g.id)) return;
    // Always fill the clicked row; DOB may reband adult↔child (counters follow onPax).
    if (g.birthDate && !guestFitsSlot(g.birthDate, slot)) {
      showWarning(t('guestAgeMismatch'));
    }
    const next = pax.map((row, i) => (i === index ? withGuestDemographics(row, g) : row));
    onPax(next);
    const chosen = next[index];
    if (chosen && (chosen.isPrimary || (!next.some((row) => row.isPrimary) && index === 0))) {
      onGuestId(g.id);
    }
    setRowHits([]);
    setRowEdit(null);
  }

  function setPackageAt(index: number, code: string) {
    onPax(
      pax.map((row, i) => (i === index ? { ...row, medicalPackageCode: code } : row)),
    );
  }

  const rows: PaxGridRow[] = useMemo(
    () => pax.map((row, _idx) => ({ ...row, _idx })),
    [pax],
  );

  const columns: EraDataGridColumn<PaxGridRow>[] = useMemo(
    () => {
      const cols: EraDataGridColumn<PaxGridRow>[] = [
      {
        key: 'role',
        header: t('partyRole'),
        className: 'whitespace-nowrap',
        render: (row) => {
          if (isMinorPax(row)) return <span className={TEXT_MUTED_CLASS}>—</span>;
          const adults = pax.filter((p) => !isMinorPax(p));
          const isPrimary = Boolean(row.isPrimary);
          const onlyAdult = adults.length <= 1;
          return (
            <button
              type="button"
              className="inline-flex items-center justify-center"
              aria-label={isPrimary ? t('primaryGuest') : t('companionGuest')}
              title={isPrimary ? t('primaryGuest') : t('companionGuest')}
              disabled={isPrimary || onlyAdult}
              onClick={() => {
                if (isPrimary || onlyAdult) return;
                setStarConfirm({ index: row._idx, kind: 'make' });
              }}
            >
              <Star
                className={`h-4 w-4 ${isPrimary ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`}
              />
            </button>
          );
        },
      },
      {
        key: 'fullName',
        header: t('name'),
        render: (row) => {
          const name =
            [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim() || '—';
          if (!row.guestId) {
            const shown = [row.firstName, row.lastName].filter(Boolean).join(' ');
            return <span className={shown ? 'text-[13px]' : TEXT_MUTED_CLASS}>{shown || '—'}</span>;
          }
          if (row.guestId && onOpenGuestCard) {
            return (
              <button
                type="button"
                className="text-left text-[13px] font-medium text-[#2980B9] underline-offset-2 hover:underline"
                data-testid="pax-name-link"
                onClick={() => onOpenGuestCard(row.guestId!)}
              >
                {name}
              </button>
            );
          }
          return <span className="text-[13px]">{name}</span>;
        },
      },
      {
        key: 'passportNo',
        header: t('passportPin'),
        className: 'whitespace-nowrap text-[12px]',
        render: (row) => {
          const passport = (row.passportNo ?? '').trim();
          const pin = (row.idCardNo ?? '').trim();
          if (!passport && !pin) return '—';
          if (passport && pin && passport !== pin) return `${passport} · ${pin}`;
          return passport || pin;
        },
      },
      {
        key: 'birthAge',
        header: t('birthAge'),
        className: 'whitespace-nowrap text-[12px]',
        render: (row) => {
          const dob = row.birthDate ? String(row.birthDate).slice(0, 10) : '';
          if (!dob) return '—';
          return `${dob} · ${ageYearsFromBirthDate(dob)}`;
        },
      },
      {
        key: 'medicalPackageCode',
        header: t('medicalPackageCode'),
        className: 'min-w-[6rem]',
        render: (row) => {
          const named = Boolean(row.guestId || row.firstName.trim() || row.lastName.trim());
          if (!named) return <span className={TEXT_MUTED_CLASS}>—</span>;
          const selected = packageOptions.some((opt) => opt.value === row.medicalPackageCode)
            ? (row.medicalPackageCode ?? '')
            : '';
          return (
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('medicalPackageCode')}
              className="[&_label]:sr-only"
              value={selected}
              onChange={(v) => setPackageAt(row._idx, Array.isArray(v) ? (v[0] ?? '') : v)}
              options={packageOptions}
              emptyLabel={t('packageFollowStay')}
            />
          );
        },
      },
      {
        key: 'guestState',
        header: t('paxStatus'),
        className: 'whitespace-nowrap',
        render: (row) =>
          !row.guestId && !row.firstName.trim() && !row.lastName.trim() ? (
            <span className={TEXT_MUTED_CLASS}>—</span>
          ) : row.departedAt ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
              {t('guestDeparted')}
            </span>
          ) : partyOpsEnabled ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-900">
              {t('guestInHouse')}
            </span>
          ) : (
            <span className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{row.guestState || '—'}</span>
          ),
      },
      {
        key: 'actions',
        header: t('partyActions'),
        className: 'whitespace-nowrap w-[7rem]',
        render: (row) => {
          const open = !row.guestId;
          const q = rowQuery.trim().toLowerCase();
          const hits = (
            q.length >= 2
              ? rowHits
              : guestOptions.filter(
                  (g) => !q || g.label.toLowerCase().includes(q) || g.id.toLowerCase().includes(q),
                )
          )
            // Keep age-mismatched guests visible — assign rebands the clicked row.
            .filter((g) => !pax.some((person) => person.guestId === g.id))
            .slice(0, 40);
          return (
          <div className="relative flex items-center justify-end gap-1">
            {open ? (
              <>
                <button
                  type="button"
                  className={GHOST_BUTTON_CLASS}
                  aria-label={t('searchGuestAria')}
                  title={t('searchGuestAria')}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    setRowEdit((v) => (v === row._idx ? null : row._idx));
                    setRowQuery('');
                    setRowHits([]);
                  }}
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={GHOST_BUTTON_CLASS}
                  aria-label={t('newGuestAria')}
                  title={t('newGuestAria')}
                  onClick={() => onNewGuest(row._idx)}
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              aria-label={t('partyRowMenu')}
              title={partyOpsEnabled ? t('partyRowMenu') : t('partyOpsRequiresInHouse')}
              onClick={() => {
                setRowEdit(null);
                setMenuOpenIdx((v) => (v === row._idx ? null : row._idx));
              }}
            >
              ⋮
            </button>
            {rowEdit === row._idx ? (
              <div className={`${DROPDOWN_PANEL_CLASS} right-0 z-20 w-64 p-2`}>
                <input
                  className={MODAL_INPUT_CLASS}
                  value={rowQuery}
                  placeholder={t('searchGuestPlaceholder')}
                  aria-label={t('searchGuest')}
                  autoFocus
                  onChange={(e) => setRowQuery(e.target.value)}
                />
                <ul className="mt-1 max-h-40 overflow-y-auto text-[13px]">
                  {hits.length === 0 ? (
                    <li className={`px-2 py-1.5 ${TEXT_MUTED_CLASS}`}>{t('searchGuestEmpty')}</li>
                  ) : (
                    hits.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          className="flex w-full px-2 py-1.5 text-left hover:bg-[#EBF5FB]"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => assignGuestAt(row._idx, g)}
                        >
                          {g.label}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
            {menuOpenIdx === row._idx ? (
              <div className={`${DROPDOWN_PANEL_CLASS} right-0 z-20`}>
                {onScanId ? (
                  <button
                    type="button"
                    className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                    onClick={() => {
                      setMenuOpenIdx(null);
                      onScanId(row.guestId ?? null, row._idx);
                    }}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {t('scanId')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    setMrzIdx(row._idx);
                  }}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {t('mrzLive')}
                </button>
                {reservationId && row.id ? (
                  <button
                    type="button"
                    className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                    onClick={() => {
                      setMenuOpenIdx(null);
                      setLinkPaxId(row.id!);
                    }}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    {t('guestAppLink')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                  disabled={!partyOpsEnabled || !onDepartGuest || Boolean(row.departedAt)}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    onDepartGuest?.(row._idx);
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('departGuest')}
                </button>
                <button
                  type="button"
                  className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                  disabled={!partyOpsEnabled || !onMoveGuest || Boolean(row.departedAt)}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    onMoveGuest?.(row._idx);
                  }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  {t('moveGuest')}
                </button>
                {clinicAdmitEnabled && row.medicalPackageCode?.trim() && !row.departedAt ? (
                  <button
                    type="button"
                    className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                    disabled={!row.id || !onClinicAdmit}
                    onClick={() => {
                      setMenuOpenIdx(null);
                      onClinicAdmit?.(row._idx);
                    }}
                  >
                    <Stethoscope className="h-3.5 w-3.5" />
                    {row.clinicAdmittedAt ? t('clinicRevokeGuest') : t('clinicAdmitGuest')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    setRemoveIdx(row._idx);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('removeFromParty')}
                </button>
              </div>
            ) : null}
          </div>
          );
        },
      },
    ];
      return showMedicalPackages ? cols : cols.filter((col) => col.key !== 'medicalPackageCode');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pax,
      equalMode,
      t,
      menuOpenIdx,
      partyOpsEnabled,
      onDepartGuest,
      onMoveGuest,
      clinicAdmitEnabled,
      onClinicAdmit,
      onOpenGuestCard,
      onScanId,
      onNewGuest,
      packageOptions,
      showMedicalPackages,
      guestOptions,
      rowEdit,
      rowHits,
      rowQuery,
    ],
  );

  return (
    <div className="space-y-3" data-testid="reservation-guests-tab">
      {!hasPartyMembers ? (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t('paxEmpty')}</p>
      ) : null}

      <div className="rounded-md border border-[#D5DADF] bg-white p-2">
        {starConfirm ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-950">
            <span>
              {starConfirm.kind === 'make' ? t('starMakePrimary') : t('starClearPrimary')}
            </span>
            <span className="flex gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setStarConfirm(null)}>
                {t('starCancel')}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  if (starConfirm.kind === 'make') {
                    const row = pax[starConfirm.index];
                    onPartyBillingMode('PRIMARY');
                    onPax(
                      pax.map((p, j) => ({
                        ...p,
                        isPrimary: j === starConfirm.index,
                        ownsFolio: true,
                      })),
                    );
                    if (row?.guestId) onGuestId(row.guestId);
                  }
                  setStarConfirm(null);
                }}
              >
                {t('starConfirm')}
              </button>
            </span>
          </div>
        ) : null}
        <HotelDataGrid<PaxGridRow>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id ?? row.guestId ?? `pax-${row._idx}`}
          emptyMessage={t('paxEmpty')}
          embedded
          pagination={false}
          paginationMode="server"
          page={1}
          pageSize={Math.max(rows.length, 1)}
          total={rows.length}
        />
      </div>

      <div className={SUBSECTION_SURFACE_CLASS} data-testid="reservation-guests-specials">
        <p className={`mb-1 text-[11px] font-medium uppercase ${TEXT_MUTED_CLASS}`}>
          {t('specialsStrip')}
        </p>
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('vipType')}
            value={vipType}
            onChange={(v) => onVipType?.(Array.isArray(v) ? v.join(',') : v)}
            options={withOrphanOption(byKind.VIP_TYPE ?? [], vipType)}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('tripReason')}
            value={tripReason}
            onChange={(v) => onTripReason?.(Array.isArray(v) ? v.join(',') : v)}
            options={withOrphanOption(byKind.TRIP_REASON ?? [], tripReason)}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#34495E]">
          <span>
            {t('voucherNo')}: <strong>{voucherNo || '—'}</strong>
          </span>
          <span>
            {t('preferredBed')}: <strong>{preferredBed || '—'}</strong>
          </span>
          <span>
            {t('preferredLocation')}: <strong>{preferredLocation || '—'}</strong>
          </span>
          <span data-testid="reservation-allergens-badge">
            {t('allergens')}:{' '}
            <strong className={allergenCount > 0 ? 'text-amber-800' : undefined}>
              {allergenCount > 0 ? allergenCount : '—'}
            </strong>
          </span>
        </div>
      </div>
      <EraModal
        open={removeIdx != null}
        title={t('removeGuestTitle')}
        onClose={() => setRemoveIdx(null)}
        footer={
          <EraModalFooter
            onCancel={() => setRemoveIdx(null)}
            submitLabel={t('removeFromParty')}
            onSubmit={() => {
              if (removeIdx != null) removeAt(removeIdx);
              setRemoveIdx(null);
            }}
          />
        }
      >
        <p className="m-0 text-[13px] text-[#34495E]">
          {t('removeGuestHint', {
            name:
              removeIdx != null
                ? [pax[removeIdx]?.firstName, pax[removeIdx]?.lastName].filter(Boolean).join(' ') ||
                  t('removeFromParty')
                : '',
          })}
        </p>
        {removeIdx != null && pax[removeIdx]?.clinicAdmittedAt ? (
          <p className="m-0 mt-2 text-[13px] text-[#34495E]">{t('clinicRevokeHint')}</p>
        ) : null}
      </EraModal>
      {reservationId && linkPaxId ? (
        <GuestAppLinkModal
          open
          reservationId={reservationId}
          paxId={linkPaxId}
          onClose={() => setLinkPaxId(null)}
        />
      ) : null}
      <EraModal
        open={mrzIdx != null}
        title={t('mrzLive')}
        onClose={() => setMrzIdx(null)}
        footer={<EraModalFooter onCancel={() => setMrzIdx(null)} />}
      >
        <MrzLiveFrame
          captureKey={String(mrzIdx ?? 'x')}
          onCaptured={(doc) => {
            if (mrzIdx == null) return;
            const next = [...pax];
            const row = next[mrzIdx];
            if (!row) return;
            next[mrzIdx] = {
              ...row,
              firstName: doc.firstName || row.firstName,
              lastName: doc.lastName || row.lastName,
              sex: doc.sex === 'MALE' ? 'M' : doc.sex === 'FEMALE' ? 'F' : row.sex,
              birthDate: doc.birthDate || row.birthDate,
              nationality: doc.nationality || row.nationality,
              passportNo: doc.documentNumber || row.passportNo,
            };
            onPax(next);
            setMrzIdx(null);
          }}
        />
      </EraModal>
      {questionnaireHint ? (
        <p className={`mt-2 text-[12px] ${TEXT_MUTED_CLASS}`}>{questionnaireHint}</p>
      ) : null}
      {familyGrants.length > 0 ? (
        <div className={`mt-3 space-y-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
          <p className="m-0 font-medium text-[#2C3E50]">{t('familyGrantsTitle')}</p>
          {familyGrants.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-2">
              <span>
                {g.grantorGuestId.slice(0, 8)} → {g.granteeGuestId.slice(0, 8)}{' '}
                {g.deskConfirmed ? t('familyGrantConfirmed') : t('familyGrantPending')}
              </span>
              {!g.deskConfirmed ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(`/api/guest-app/staff/family-grants/${g.id}/confirm`, {
                      method: 'POST',
                    }).then((res) => {
                      if (!res.ok) return;
                      setFamilyGrants((rows) =>
                        rows.map((row) =>
                          row.id === g.id ? { ...row, deskConfirmed: true } : row,
                        ),
                      );
                    });
                  }}
                >
                  {t('familyGrantConfirm')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {stayOrders.length > 0 ? (
        <div className={`mt-3 space-y-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
          <p className="m-0 font-medium text-[#2C3E50]">{t('stayOrdersTitle')}</p>
          {stayOrders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <span>
                {o.kind} · {o.status}
                {o.note ? ` — ${o.note}` : ''}
              </span>
              {o.status === 'REQUESTED' || o.status === 'QUEUED' ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(`/api/guest-app/staff/orders/${o.id}`, {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ status: 'CONFIRMED' }),
                    }).then((res) => {
                      if (!res.ok) return;
                      setStayOrders((rows) =>
                        rows.map((row) =>
                          row.id === o.id ? { ...row, status: 'CONFIRMED' } : row,
                        ),
                      );
                    });
                  }}
                >
                  {t('stayOrderConfirm')}
                </button>
              ) : null}
              {o.status === 'CONFIRMED' ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void fetch(`/api/guest-app/staff/orders/${o.id}`, {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ status: 'COMPLETED' }),
                    }).then((res) => {
                      if (!res.ok) return;
                      setStayOrders((rows) =>
                        rows.map((row) =>
                          row.id === o.id ? { ...row, status: 'COMPLETED' } : row,
                        ),
                      );
                    });
                  }}
                >
                  {t('stayOrderComplete')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {reservationId && pax.some((row) => row.id) ? (
        <div className={`mt-3 space-y-2 text-[12px] ${TEXT_MUTED_CLASS}`}>
          <p className="m-0 font-medium text-[#2C3E50]">{t('guestMsgTitle')}</p>
          <p className="m-0">{t('guestMsgHint')}</p>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('guestMsgPax')}
            value={msgPaxId || (pax.find((row) => row.id)?.id ?? '')}
            options={pax
              .filter((row) => row.id)
              .map((row) => ({
                value: String(row.id),
                label:
                  [row.firstName, row.lastName].filter(Boolean).join(' ') ||
                  String(row.id).slice(0, 8),
              }))}
            onChange={(next) => setMsgPaxId(String(next))}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('guestMsgKind')}
            value={msgKind}
            options={[
              { value: 'RECEPTION', label: t('guestMsgKindReception') },
              { value: 'CLINIC', label: t('guestMsgKindClinic') },
              { value: 'MARKETING', label: t('guestMsgKindMarketing') },
            ]}
            onChange={(next) =>
              setMsgKind(String(next) as 'RECEPTION' | 'CLINIC' | 'MARKETING')
            }
          />
          <label className="block">
            {t('guestMsgBody')}
            <textarea
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              rows={2}
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={msgBusy || !msgBody.trim()}
            onClick={() => {
              const paxId = msgPaxId || pax.find((row) => row.id)?.id;
              if (!reservationId || !paxId) return;
              setMsgBusy(true);
              setMsgHint(null);
              void fetch(
                `/api/guest-app/reservations/${reservationId}/pax/${paxId}/messages`,
                {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ kind: msgKind, body: msgBody.trim() }),
                },
              )
                .then(async (res) => {
                  if (!res.ok) {
                    setMsgHint(t('guestMsgFail'));
                    return;
                  }
                  setMsgBody('');
                  setMsgHint(t('guestMsgSent'));
                })
                .finally(() => setMsgBusy(false));
            }}
          >
            {t('guestMsgSend')}
          </button>
          {msgHint ? <p className="m-0">{msgHint}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
