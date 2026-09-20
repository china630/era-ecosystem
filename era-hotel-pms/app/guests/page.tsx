'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  FieldSelect,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  NATIONALITY_OPTIONS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  usePaginatedList,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import GuestCardModal from '@/components/GuestCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { formatGuestGenderLabel, type GuestListItem } from '@/lib/guest-list-identity';
import { useListPaginationLabels } from '@/hooks/useListPaginationLabels';

type ListFilters = {
  q: string;
  gender: string;
  nationality: string;
  fin: string;
  passport: string;
  birthDateFrom: string;
  birthDateTo: string;
  email: string;
  phone: string;
  externalRef: string;
};

const EMPTY_FILTERS: ListFilters = {
  q: '',
  gender: '',
  nationality: '',
  fin: '',
  passport: '',
  birthDateFrom: '',
  birthDateTo: '',
  email: '',
  phone: '',
  externalRef: '',
};

function dash(value: string | null | undefined): string {
  const s = value?.trim();
  return s ? s : '—';
}

export default function GuestsPage() {
  const { can } = useAuth();
  const t = useTranslations('guestsPage');
  const tc = useTranslations('common');
  const paginationLabels = useListPaginationLabels();
  const [cardOpen, setCardOpen] = useState(false);
  const [cardGuestId, setCardGuestId] = useState<string | null>(null);
  const [filtersState, setFiltersState] = useState<ListFilters>(EMPTY_FILTERS);

  const filters = useMemo(() => filtersState, [filtersState]);

  const genderLabels = useMemo(
    () => ({
      male: t('genderMale'),
      female: t('genderFemale'),
      other: t('genderOther'),
    }),
    [t],
  );

  const fetcher = useCallback(
    async ({
      page,
      pageSize,
      filters: f,
    }: {
      page: number;
      pageSize: number;
      filters: ListFilters;
    }) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (f.q.trim()) params.set('q', f.q.trim());
      if (f.gender) params.set('gender', f.gender);
      if (f.nationality) params.set('nationality', f.nationality);
      if (f.fin.trim()) params.set('fin', f.fin.trim());
      if (f.passport.trim()) params.set('passport', f.passport.trim());
      if (f.birthDateFrom) params.set('birthDateFrom', f.birthDateFrom);
      if (f.birthDateTo) params.set('birthDateTo', f.birthDateTo);
      if (f.email.trim()) params.set('email', f.email.trim());
      if (f.phone.trim()) params.set('phone', f.phone.trim());
      if (f.externalRef.trim()) params.set('externalRef', f.externalRef.trim());
      const res = await fetch(`/api/guests?${params}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        throw new Error(typeof data?.error === 'string' ? data.error : tc('loadError'));
      }
      return data;
    },
    [tc],
  );

  const {
    items: rows,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    reload,
  } = usePaginatedList<GuestListItem, ListFilters>({ fetcher, filters });

  function patchFilter(patch: Partial<ListFilters>) {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }

  function openCreate() {
    setCardGuestId(null);
    setCardOpen(true);
  }

  function openEdit(guest: GuestListItem) {
    setCardGuestId(guest.id);
    setCardOpen(true);
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t('title')}
          actions={
            can(PERMISSIONS.RESERVATIONS_WRITE) ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                {t('addGuest')}
              </button>
            ) : undefined
          }
        />
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tc('filterReset')}
            onReset={() => setFiltersState(EMPTY_FILTERS)}
          >
            <Field
              label={tc('search')}
              preset="longText"
              placeholder={t('filterPlaceholder')}
              value={filtersState.q}
              onChange={(e) => patchFilter({ q: e.target.value })}
            />
            <FieldSelect
              label={t('gender')}
              preset="select"
              value={filtersState.gender}
              onChange={(e) => patchFilter({ gender: e.target.value })}
            >
              <option value="">{tc('all')}</option>
              <option value="M">{t('genderMale')}</option>
              <option value="F">{t('genderFemale')}</option>
            </FieldSelect>
            <CatalogField
              kind="SEARCHABLE"
              label={t('nationality')}
              value={filtersState.nationality}
              onChange={(v) =>
                patchFilter({ nationality: (Array.isArray(v) ? v[0] : v) ?? '' })
              }
              options={[{ value: '', label: tc('all') }, ...NATIONALITY_OPTIONS]}
            />
            <Field
              label={t('fin')}
              preset="code"
              value={filtersState.fin}
              onChange={(e) => patchFilter({ fin: e.target.value })}
            />
            <Field
              label={t('passport')}
              preset="code"
              value={filtersState.passport}
              onChange={(e) => patchFilter({ passport: e.target.value })}
            />
            <DatePicker
              label={t('birthDateFrom')}
              value={filtersState.birthDateFrom}
              onChange={(v) => patchFilter({ birthDateFrom: v })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
            <DatePicker
              label={t('birthDateTo')}
              value={filtersState.birthDateTo}
              onChange={(v) => patchFilter({ birthDateTo: v })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
            <Field
              label={t('phone')}
              preset="phone"
              value={filtersState.phone}
              onChange={(e) => patchFilter({ phone: e.target.value })}
            />
            <Field
              label={t('email')}
              preset="shortText"
              value={filtersState.email}
              onChange={(e) => patchFilter({ email: e.target.value })}
            />
            <Field
              label={t('externalRef')}
              preset="code"
              value={filtersState.externalRef}
              onChange={(e) => patchFilter({ externalRef: e.target.value })}
            />
          </EraListFilterBar>
        }
        table={
          <HotelDataGrid<GuestListItem & Record<string, unknown>>
            columns={[
              {
                key: 'name',
                header: t('name'),
                render: (r) => (
                  <span>
                    {r.title ? `${r.title} ` : ''}
                    {r.fullName}
                  </span>
                ),
              },
              {
                key: 'gender',
                header: t('gender'),
                render: (r) => formatGuestGenderLabel(r.sex, genderLabels),
              },
              {
                key: 'birthDate',
                header: t('birthDate'),
                render: (r) => dash(r.birthDate),
              },
              {
                key: 'nationality',
                header: t('nationality'),
                render: (r) => r.nationality,
              },
              {
                key: 'fin',
                header: t('fin'),
                render: (r) => dash(r.nationalIdFin),
              },
              {
                key: 'passport',
                header: t('passport'),
                render: (r) => dash(r.passportNumber),
              },
              {
                key: 'phone',
                header: t('phone'),
                render: (r) => dash(r.phone),
              },
              {
                key: 'email',
                header: t('email'),
                render: (r) => dash(r.email),
              },
              {
                key: 'externalRef',
                header: t('externalRef'),
                render: (r) => dash(r.externalRef),
              },
              {
                key: 'mdm',
                header: t('mdmLink'),
                render: (r) =>
                  r.globalPersonId ? (
                    <span className="text-emerald-700">{t('mdmLinked')}</span>
                  ) : (
                    <span className="text-[#7F8C8D]">—</span>
                  ),
              },
              {
                key: 'actions',
                header: tc('actions'),
                render: (r) =>
                  can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                    <button
                      type="button"
                      className="text-[#2980B9] hover:underline"
                      onClick={() => openEdit(r)}
                    >
                      {t('viewProfile')}
                    </button>
                  ) : null,
              },
            ]}
            rows={rows as (GuestListItem & Record<string, unknown>)[]}
            rowKey={(r) => r.id}
            emptyMessage={loading ? tc('loading') : t('empty')}
            pagination={false}
            paginationMode="server"
            embedded
          />
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={paginationLabels}
          />
        }
      />

      <GuestCardModal
        open={cardOpen}
        guestId={cardGuestId}
        onClose={() => {
          setCardOpen(false);
          setCardGuestId(null);
          void reload();
        }}
      />
    </div>
  );
}
