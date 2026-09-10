'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, UserPlus, UserSearch } from 'lucide-react';
import {
  CatalogField,
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
  Field,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
  showSuccess,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useHotelLookupOptions, withOrphanOption } from '@/lib/hotel-lookups';
import {
  attachGuestToPax,
  splitFullName,
} from '@/components/reservation-card/party-pax';
import type { PartyBillingMode, PaxRow, SelectOption } from './types';

export { emptyPax } from '@/components/reservation-card/party-pax';

type PaxGridRow = PaxRow & Record<string, unknown> & { _idx: number };

/**
 * Compact party list (HOT-BOOK-06): role · name link · docs · DOB/age · medical badge · status · ⋮.
 */
export function ReservationCardGuestsTab({
  guestId,
  guestOptions,
  pax,
  partyBillingMode,
  onPartyBillingMode: _onPartyBillingMode,
  onGuestId,
  onPax,
  onNewGuest,
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
  onNewGuest: () => void;
  onRepeatGuest?: () => void;
  /** Open existing guest profile (name click). */
  onOpenGuestCard?: (guestId: string) => void;
  /** Open guest card with ID reader stub (Scan ID). */
  onScanId?: (guestId: string | null) => void;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteHits, setRemoteHits] = useState<SelectOption[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [menuOpenIdx, setMenuOpenIdx] = useState<number | null>(null);
  const equalMode = partyBillingMode === 'EQUAL';

  const hasPartyMembers = pax.some(
    (p) => Boolean(p.guestId) || Boolean(p.firstName.trim()) || Boolean(p.lastName.trim()),
  );

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setRemoteHits(null);
      return;
    }
    const handle = window.setTimeout(() => {
      setSearchBusy(true);
      void fetch(`/api/guests?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((list) => {
          if (!Array.isArray(list)) {
            setRemoteHits([]);
            return;
          }
          setRemoteHits(
            list.map((x: { id: string; fullName: string }) => ({
              id: x.id,
              label: x.fullName,
            })),
          );
        })
        .catch(() => setRemoteHits([]))
        .finally(() => setSearchBusy(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, searchOpen]);

  const filtered = useMemo(() => {
    if (remoteHits) return remoteHits;
    const q = query.trim().toLowerCase();
    if (!q) return guestOptions.slice(0, 40);
    return guestOptions
      .filter((g) => g.label.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
      .slice(0, 40);
  }, [guestOptions, query, remoteHits]);

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

  function pickGuest(g: SelectOption) {
    const { firstName, lastName } = splitFullName(g.label);
    const attached = attachGuestToPax(
      pax,
      { id: g.id, firstName, lastName },
      { equalMode, reservationGuestId: guestId },
    );
    onGuestId(attached.guestId);
    onPax(attached.pax);
    setSearchOpen(false);
    setQuery('');
    setRemoteHits(null);
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
          if (equalMode) {
            return <span className="text-[12px]">{t('equalPeerGuest')}</span>;
          }
          const isPrimary =
            Boolean(row.isPrimary) || (!pax.some((p) => p.isPrimary) && row._idx === 0);
          return (
            <label className="inline-flex items-center gap-1.5 text-[12px]">
              <input
                type="radio"
                name="primary-pax"
                checked={isPrimary}
                onChange={() => setPrimaryAt(row._idx)}
                aria-label={t('masterGuest')}
              />
              {isPrimary ? t('primaryGuest') : t('companionGuest')}
            </label>
          );
        },
      },
      {
        key: 'fullName',
        header: t('name'),
        render: (row) => {
          const name =
            [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim() || '—';
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
          const age = row.age || '';
          if (!dob && !age) return '—';
          if (dob && age) return `${dob} · ${age}`;
          return dob || age;
        },
      },
      {
        key: 'medicalPackageCode',
        header: t('medicalPackageCode'),
        className: 'min-w-[6rem]',
        render: (row) =>
          row.medicalPackageCode ? (
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-900">
              {row.medicalPackageCode}
            </span>
          ) : (
            <span className={TEXT_MUTED_CLASS}>—</span>
          ),
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
        className: 'whitespace-nowrap w-[3rem]',
        render: (row) => (
          <div className="relative flex items-center justify-end">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              aria-label={t('partyRowMenu')}
              title={partyOpsEnabled ? t('partyRowMenu') : t('partyOpsRequiresInHouse')}
              onClick={() => setMenuOpenIdx((v) => (v === row._idx ? null : row._idx))}
            >
              ⋮
            </button>
            {menuOpenIdx === row._idx ? (
              <div className={`${DROPDOWN_PANEL_CLASS} right-0 z-20`}>
                <button
                  type="button"
                  className={DROPDOWN_ITEM_CLASS}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    onScanId?.(row.guestId ?? null);
                  }}
                >
                  {t('scanId')}
                </button>
                <button
                  type="button"
                  className={DROPDOWN_ITEM_CLASS}
                  disabled={!partyOpsEnabled || !onDepartGuest || Boolean(row.departedAt)}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    onDepartGuest?.(row._idx);
                  }}
                >
                  {t('departGuest')}
                </button>
                <button
                  type="button"
                  className={DROPDOWN_ITEM_CLASS}
                  disabled={!partyOpsEnabled || !onMoveGuest || Boolean(row.departedAt)}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    onMoveGuest?.(row._idx);
                  }}
                >
                  {t('moveGuest')}
                </button>
                <button
                  type="button"
                  className={DROPDOWN_ITEM_CLASS}
                  onClick={() => {
                    setMenuOpenIdx(null);
                    removeAt(row._idx);
                  }}
                >
                  {t('removeFromParty')}
                </button>
              </div>
            ) : null}
          </div>
        ),
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
    ],
  );

  return (
    <div className="space-y-3" data-testid="reservation-guests-tab">
      {!hasPartyMembers ? (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t('paxEmpty')}</p>
      ) : null}

      <div className="rounded-md border border-[#D5DADF] bg-white p-2">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            title={t('newGuestAria')}
            aria-label={t('newGuestAria')}
            onClick={onNewGuest}
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            title={t('searchGuestAria')}
            aria-label={t('searchGuestAria')}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <UserSearch className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            title={t('cameraStub')}
            aria-label={t('camera')}
            onClick={() => showSuccess(t('cameraStub'))}
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
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

      {searchOpen ? (
        <div className="space-y-2 rounded-md border border-[#D5DADF] bg-[#F8F9FA] p-3">
          <Field
            label={t('searchGuest')}
            preset="longText"
            className="min-w-0"
            inputClassName="w-full min-w-0 max-w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchGuestPlaceholder')}
            hint={t('searchAddsCompanionHint')}
            autoFocus
          />
          <ul className="max-h-48 overflow-y-auto rounded border border-[#D5DADF] bg-white text-[13px]">
            {searchBusy ? (
              <li className={`px-3 py-2 ${TEXT_MUTED_CLASS}`}>{t('searchGuestLoading')}</li>
            ) : filtered.length === 0 ? (
              <li className={`px-3 py-2 ${TEXT_MUTED_CLASS}`}>{t('searchGuestEmpty')}</li>
            ) : (
              filtered.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#EBF5FB]"
                    onClick={() => pickGuest(g)}
                  >
                    <span>{g.label}</span>
                    {g.id === guestId ? (
                      <span className="text-[11px] text-[#2980B9]">{t('selected')}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="flex justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setSearchOpen(false)}>
              {t('closeSearch')}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onNewGuest}>
              {t('newGuestAria')}
            </button>
          </div>
        </div>
      ) : null}

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
