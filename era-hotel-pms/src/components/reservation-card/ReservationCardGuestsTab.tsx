'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, UserPlus, UserSearch } from 'lucide-react';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  CatalogField,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showSuccess,
  type EraDataGridColumn,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import {
  attachGuestToPax,
  splitFullName,
} from '@/components/reservation-card/party-pax';
import type { PartyBillingMode, PaxRow, SelectOption } from './types';

export { emptyPax } from '@/components/reservation-card/party-pax';

const MEDICAL_PKG_OPTIONS = [
  { value: 'PKG-STANDART', label: 'PKG-STANDART' },
  { value: 'PKG-PREMIUM', label: 'PKG-PREMIUM' },
  { value: 'PKG-DERMO', label: 'PKG-DERMO' },
  { value: 'PKG-DETOKS', label: 'PKG-DETOKS' },
];

type PaxGridRow = PaxRow & Record<string, unknown> & { _idx: number };

/**
 * Party list: PRIMARY = one folio owner + companions; EQUAL = each peer owns a GUEST folio.
 * + opens guest card (create); search attaches an existing guest as primary or companion.
 */
export function ReservationCardGuestsTab({
  guestId,
  guestOptions,
  pax,
  partyBillingMode,
  onPartyBillingMode,
  onGuestId,
  onPax,
  onNewGuest,
}: {
  isCreate?: boolean;
  guestId: string;
  guestOptions: SelectOption[];
  pax: PaxRow[];
  partyBillingMode: PartyBillingMode;
  onPartyBillingMode: (mode: PartyBillingMode) => void;
  onGuestId: (id: string) => void;
  /** Replaces party list; parent syncs adults/children to row count. */
  onPax: (rows: PaxRow[]) => void;
  onNewGuest: () => void;
  onRepeatGuest?: () => void;
}) {
  const t = useTranslations('reservationCard');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteHits, setRemoteHits] = useState<SelectOption[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const equalMode = partyBillingMode === 'EQUAL';

  const primaryPax = pax.find((p) => p.isPrimary) ?? pax[0];
  const primaryFromPax =
    primaryPax && (primaryPax.firstName.trim() || primaryPax.lastName.trim())
      ? [primaryPax.firstName, primaryPax.lastName].filter(Boolean).join(' ').trim()
      : '';
  const selectedLabel =
    guestOptions.find((g) => g.id === guestId)?.label ??
    remoteHits?.find((g) => g.id === guestId)?.label ??
    primaryFromPax;
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

  function applyPartyBillingMode(mode: PartyBillingMode) {
    onPartyBillingMode(mode);
    if (mode === 'EQUAL') {
      onPax(pax.map((p) => ({ ...p, ownsFolio: true })));
    } else {
      onPax(
        pax.map((p, i) => ({
          ...p,
          ownsFolio: Boolean(p.isPrimary) || (!pax.some((r) => r.isPrimary) && i === 0),
        })),
      );
    }
  }

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

  /** Search pick: fill incomplete slot first; else append companion / create primary. */
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
          const isPrimary = Boolean(row.isPrimary) || (!pax.some((p) => p.isPrimary) && row._idx === 0);
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
        key: 'firstName',
        header: t('name'),
        render: (row) => row.firstName || '—',
      },
      {
        key: 'middleName',
        header: t('patronymic'),
        render: (row) => row.middleName || '—',
      },
      {
        key: 'lastName',
        header: t('surname'),
        render: (row) => row.lastName || '—',
      },
      {
        key: 'nationality',
        header: t('nationality'),
        render: (row) => row.nationality || '—',
      },
      {
        key: 'age',
        header: t('age'),
        className: 'text-center',
        render: (row) => row.age || '—',
      },
      {
        key: 'passportNo',
        header: t('passport'),
        render: (row) => row.passportNo || row.idCardNo || '—',
      },
      {
        key: 'medicalPackageCode',
        header: t('medicalPackageCode'),
        className: 'min-w-[9rem]',
        render: (row) => (
          <CatalogField
            kind="CLOSED_SMALL"
            name={`pax-pkg-${row._idx}`}
            label={t('medicalPackageCode')}
            value={row.medicalPackageCode ?? ''}
            onChange={(v) => {
              const next = pax.map((p, i) =>
                i === row._idx ? { ...p, medicalPackageCode: String(v ?? '') } : p,
              );
              onPax(next);
            }}
            options={MEDICAL_PKG_OPTIONS}
            emptyLabel="—"
            className="mb-0"
          />
        ),
      },
      {
        key: 'payStatus',
        header: t('payStatus'),
        render: (row) => row.payStatus || '—',
      },
      {
        key: 'actions',
        header: t('partyActions'),
        className: 'whitespace-nowrap',
        render: (row) => (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => removeAt(row._idx)}
          >
            {t('removeFromParty')}
          </button>
        ),
      },
    ],
    // setPrimaryAt / removeAt close over pax — refresh when pax / mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pax, equalMode, t],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[12px] font-medium ${TEXT_MUTED_CLASS}`}>{t('partyBillingMode')}</span>
          <div className={CHIP_GROUP_CLASS} role="group" aria-label={t('partyBillingMode')}>
            <button
              type="button"
              className={partyBillingMode === 'PRIMARY' ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
              onClick={() => applyPartyBillingMode('PRIMARY')}
            >
              {t('partyBillingPrimary')}
            </button>
            <button
              type="button"
              className={partyBillingMode === 'EQUAL' ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
              onClick={() => applyPartyBillingMode('EQUAL')}
            >
              {t('partyBillingEqual')}
            </button>
          </div>
        </div>
        <p className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{t('hintPartyBilling')}</p>
      </div>

      {hasPartyMembers && selectedLabel ? (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
          {equalMode ? t('equalPeerGuest') : t('primaryGuest')}:{' '}
          <strong className="text-[#34495E]">{selectedLabel}</strong>
          {!equalMode ? <span className="ml-2">{t('companionsHint')}</span> : null}
        </p>
      ) : !hasPartyMembers ? (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t('paxEmpty')}</p>
      ) : null}

      <HotelDataGrid<PaxGridRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id ?? row.guestId ?? `pax-${row._idx}`}
        emptyMessage={t('paxEmpty')}
        pagination={false}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              title={t('newGuestAria')}
              aria-label={t('newGuestAria')}
              onClick={onNewGuest}
            >
              <UserPlus className="h-4 w-4" />
              <span className="ml-1">{t('addPartyMember')}</span>
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              title={t('searchGuestAria')}
              aria-label={t('searchGuestAria')}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <UserSearch className="h-4 w-4" />
              <span className="ml-1">{t('searchGuest')}</span>
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              title={t('cameraStub')}
              aria-label={t('camera')}
              onClick={() => showSuccess(t('cameraStub'))}
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
        }
      />

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
    </div>
  );
}
