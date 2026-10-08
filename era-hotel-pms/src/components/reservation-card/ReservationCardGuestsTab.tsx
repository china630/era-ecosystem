'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightLeft, Camera, LogOut, Search, Star, Trash2, UserPlus } from 'lucide-react';
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
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
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
  guestOptions,
  pax,
  partyBillingMode,
  onPartyBillingMode,
  onGuestId,
  onPax,
  onNewGuest,
  packageOptions = [],
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
}: {
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
  /** Medical SKUs for a named guest. Empty value means the stay package. */
  packageOptions?: Array<{ value: string; label: string }>;
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
}) {
  const t = useTranslations('reservationCard');
  const { byKind } = useHotelLookupOptions(['VIP_TYPE', 'TRIP_REASON']);
  const [menuOpenIdx, setMenuOpenIdx] = useState<number | null>(null);
  const [rowEdit, setRowEdit] = useState<number | null>(null);
  const [rowQuery, setRowQuery] = useState('');
  const [rowHits, setRowHits] = useState<SelectOption[]>([]);
  const [starConfirm, setStarConfirm] = useState<null | { index: number; kind: 'make' | 'clear' }>(
    null,
  );
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
        ownsFolio: j === index,
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
      if (!equalMode) {
        for (let i = 1; i < next.length; i++) next[i] = { ...next[i], ownsFolio: false };
      }
      if (next[0].guestId) onGuestId(next[0].guestId);
      else onGuestId('');
    } else if (next.length === 0) {
      onGuestId('');
    }
    onPax(next);
  }

  function assignGuestAt(index: number, g: SelectOption) {
    const slot = pax[index];
    if (!slot || !guestFitsSlot(g.birthDate, slot)) return;
    if (pax.some((row, i) => i !== index && row.guestId === g.id)) return;
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
    () => [
      {
        key: 'role',
        header: t('partyRole'),
        className: 'whitespace-nowrap',
        render: (row) => {
          if (isMinorPax(row)) return <span className={TEXT_MUTED_CLASS}>—</span>;
          const adults = pax.filter((p) => !isMinorPax(p));
          const isPrimary =
            !equalMode &&
            (Boolean(row.isPrimary) || (!pax.some((p) => p.isPrimary) && row._idx === 0));
          const onlyAdult = adults.length <= 1;
          return (
            <button
              type="button"
              className="inline-flex items-center justify-center"
              aria-label={isPrimary ? t('primaryGuest') : t('companionGuest')}
              title={isPrimary ? t('primaryGuest') : t('companionGuest')}
              disabled={onlyAdult && isPrimary}
              onClick={() => {
                if (onlyAdult && isPrimary) return;
                if (!isPrimary && pax.some(isMinorPax) === false) {
                  setStarConfirm({ index: row._idx, kind: 'make' });
                  return;
                }
                if (!isPrimary) {
                  setStarConfirm({ index: row._idx, kind: 'make' });
                  return;
                }
                if (pax.some(isMinorPax)) return;
                setStarConfirm({ index: row._idx, kind: 'clear' });
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
          row.departedAt ? (
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
            .filter(
              (g) =>
                guestFitsSlot(g.birthDate, row) && !pax.some((person) => person.guestId === g.id),
            )
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
                <button
                  type="button"
                  className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    onScanId?.(row.guestId ?? null, row._idx);
                  }}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {t('scanId')}
                </button>
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
                <button
                  type="button"
                  className={`${DROPDOWN_ITEM_CLASS} flex items-center gap-2`}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    removeAt(row._idx);
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pax,
      equalMode,
      t,
      menuOpenIdx,
      partyOpsEnabled,
      onDepartGuest,
      onMoveGuest,
      onOpenGuestCard,
      onScanId,
      onNewGuest,
      packageOptions,
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
                        ownsFolio: j === starConfirm.index || isMinorPax(p) ? j === starConfirm.index : false,
                      })),
                    );
                    if (row?.guestId) onGuestId(row.guestId);
                  } else {
                    onPartyBillingMode('EQUAL');
                    onPax(
                      pax.map((row) => ({
                        ...row,
                        isPrimary: false,
                        ownsFolio: !isMinorPax(row),
                      })),
                    );
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
    </div>
  );
}
