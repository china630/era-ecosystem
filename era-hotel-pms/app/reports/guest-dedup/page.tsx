'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Summary = {
  totalGuests: number;
  withoutGlobalPersonId: number;
  withoutMdmLink: number;
  suspectedDuplicateGroups: number;
  suspectedDuplicateGuests: number;
};

type MatchType =
  | 'PHONE'
  | 'GLOBAL_PERSON_ID'
  | 'PASSPORT'
  | 'FIN'
  | 'EMAIL'
  | 'NAME_BIRTH'
  | 'LAST_BIRTH'
  | 'LAST_PHONE'
  | 'DOC_CITIZENSHIP';

type GuestCard = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  sex: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  passportNo: string | null;
  fin: string | null;
  linked: boolean;
  stayCount: number;
  inHouse: boolean;
};

type Group = {
  key: string;
  matchType: MatchType;
  guestIds: string[];
  needsPersonMerge: boolean;
  guests: GuestCard[];
};

type PendingMerge = {
  survivorId: string;
  duplicateIds: string[];
  needsPersonMerge: boolean;
};

export default function GuestDedupReportPage() {
  const { can } = useAuth();
  const t = useTranslations('guestDedup');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pending, setPending] = useState<PendingMerge | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchFilter, setMatchFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const visibleGroups = groups.filter(
    (group) => matchFilter === 'all' || group.matchType === matchFilter,
  );

  const load = useCallback(() => {
    void fetch('/api/admin/guest-dedup/summary')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          showApiError(d);
          return;
        }
        setSummary(d.summary ?? d.data?.summary ?? null);
        setGroups(d.groups ?? d.data?.groups ?? []);
      })
      .catch(() => showApiError({ error: t('loadFailed') }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function merge(confirmPersonMerge = false) {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/guest-dedup/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, confirmPersonMerge }),
      });
      const json = await res.json();
      if (res.status === 409 && json.needsPersonMerge) {
        setPending({ ...pending, needsPersonMerge: true });
        return;
      }
      if (!res.ok) {
        showApiError(json);
        return;
      }
      showSuccess(t('merged'));
      setPending(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(guestIds: string[]) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/guest-dedup/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json);
        return;
      }
      showSuccess(t('dismissed'));
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{t('noAccess')}</p>;
  }

  const canMerge = can(PERMISSIONS.RESERVATIONS_WRITE);
  const survivor = pending
    ? groups.flatMap((group) => group.guests).find((guest) => guest.id === pending.survivorId)
    : null;

  return (
    <>
      <PageHeader
        title={t('title')}
        leading={
          <Link href="/reports/analytics" className="text-[13px] text-[#2980B9] hover:underline">
            {t('analytics')}
          </Link>
        }
      />
      {summary && (
        <section className={`${CARD_CONTAINER_CLASS} mb-4 grid grid-cols-2 gap-3 p-4 text-[13px] md:grid-cols-3`}>
          <div>{t('total')}: <strong>{summary.totalGuests}</strong></div>
          <div>{t('withoutPerson')}: <strong>{summary.withoutGlobalPersonId}</strong></div>
          <div>{t('groups')}: <strong>{summary.suspectedDuplicateGroups}</strong></div>
          <div>{t('inGroups')}: <strong>{summary.suspectedDuplicateGuests}</strong></div>
        </section>
      )}
      {pending && (
        <section className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4 text-[13px]`}>
          <p className="m-0 font-semibold text-[#34495E]">
            {pending.needsPersonMerge ? t('confirmPeople') : t('confirmKeep')}
          </p>
          <p className="m-0 text-[#34495E]">
            {t('keepName', { name: survivor?.fullName ?? '' })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void merge(pending.needsPersonMerge)}
            >
              {pending.needsPersonMerge ? t('mergePeople') : t('keep')}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => setPending(null)}
            >
              {t('cancel')}
            </button>
          </div>
        </section>
      )}
      <CatalogField
        kind="CLOSED_SMALL"
        label={t('matchAll')}
        value={matchFilter}
        onChange={(next) => setMatchFilter(String(next))}
        emptyLabel={null}
        options={[
          { value: 'all', label: t('matchAll') },
          ...([
            'PHONE',
            'PASSPORT',
            'FIN',
            'EMAIL',
            'NAME_BIRTH',
            'LAST_BIRTH',
            'LAST_PHONE',
            'DOC_CITIZENSHIP',
            'GLOBAL_PERSON_ID',
          ] as const).map(
            (code) => ({ value: code, label: t(`match.${code}`) }),
          ),
        ]}
      />
      <section className="space-y-3">
        {visibleGroups.map((group) => (
          <article
            key={`${group.matchType}-${group.key}`}
            className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
          >
            <h2 className="m-0 text-[13px] font-semibold text-[#34495E]">
              {t(`match.${group.matchType}`)}
              {group.matchType === 'NAME_BIRTH' || group.matchType === 'GLOBAL_PERSON_ID'
                ? ''
                : ` · ${group.key}`}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.guests.map((guest) => (
                <div key={guest.id} className="space-y-2 rounded border border-[#ECEFF1] p-3 text-[13px]">
                  <div className="font-semibold text-[#2C3E50]">{guest.fullName}</div>
                  {canMerge && editingId === guest.id ? (
                    <GuestEditForm
                      guest={guest}
                      busy={busy}
                      onCancel={() => setEditingId(null)}
                      onSave={async (body) => {
                        setBusy(true);
                        try {
                          const res = await fetch(`/api/guests/${guest.id}/full`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            showApiError(data);
                            return;
                          }
                          showSuccess(t('guestSaved'));
                          setEditingId(null);
                          load();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  ) : null}
                  {canMerge && editingId !== guest.id ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setEditingId(guest.id)}>
                      {t('editGuest')}
                    </button>
                  ) : null}
                  <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-[#34495E]">
                    <dt className="text-[#7F8C8D]">{t('birth')}</dt>
                    <dd className="m-0">{guest.birthDate || '—'}</dd>
                    <dt className="text-[#7F8C8D]">{t('sex')}</dt>
                    <dd className="m-0">{guest.sex || '—'}</dd>
                    <dt className="text-[#7F8C8D]">{t('citizenship')}</dt>
                    <dd className="m-0">{guest.nationality || '—'}</dd>
                    <dt className="text-[#7F8C8D]">{t('phone')}</dt>
                    <dd className="m-0">{guest.phone || '—'}</dd>
                    <dt className="text-[#7F8C8D]">{t('passport')}</dt>
                    <dd className="m-0">{guest.passportNo || '—'}</dd>
                    <dt className="text-[#7F8C8D]">{t('fin')}</dt>
                    <dd className="m-0">{guest.fin || '—'}</dd>
                    <dt className="text-[#7F8C8D]">{t('stays')}</dt>
                    <dd className="m-0">
                      {guest.stayCount}
                      {guest.inHouse ? ` · ${t('inHouse')}` : ''}
                    </dd>
                    <dt className="text-[#7F8C8D]">{t('registry')}</dt>
                    <dd className="m-0">{guest.linked ? t('linked') : t('notLinked')}</dd>
                  </dl>
                  {canMerge ? (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() =>
                        setPending({
                          survivorId: guest.id,
                          duplicateIds: group.guestIds.filter((id) => id !== guest.id),
                          needsPersonMerge: group.needsPersonMerge,
                        })
                      }
                    >
                      {t('keepThis')}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {canMerge ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void dismiss(group.guestIds)}
              >
                {t('notDuplicates')}
              </button>
            ) : null}
          </article>
        ))}
        {visibleGroups.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t('empty')}</p>
        ) : null}
      </section>
    </>
  );
}

function GuestEditForm({
  guest,
  busy,
  onCancel,
  onSave,
}: {
  guest: GuestCard;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: {
    firstName: string;
    lastName: string;
    phone: string | null;
    birthDate: string | null;
  }) => Promise<void>;
}) {
  const t = useTranslations('guestDedup');
  const tc = useTranslations('common');
  const [lastName, setLastName] = useState(guest.lastName ?? '');
  const [firstName, setFirstName] = useState(guest.firstName ?? '');
  const [phone, setPhone] = useState(guest.phone ?? '');
  const [birthDate, setBirthDate] = useState(guest.birthDate ?? '');
  return (
    <div className="space-y-2">
      <Field label={t('lastName')} preset="shortText" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <Field label={t('firstName')} preset="shortText" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      <Field label={t('phone')} preset="shortText" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <DatePicker
        label={t('birth')}
        value={birthDate}
        onChange={setBirthDate}
        placeholder={tc('datePlaceholder')}
        openCalendarLabel={tc('openCalendar')}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() =>
            void onSave({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone.trim() || null,
              birthDate: birthDate || null,
            })
          }
        >
          {t('saveGuest')}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
