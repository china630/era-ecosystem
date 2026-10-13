'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
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

type GuestCard = {
  id: string;
  fullName: string;
  birthDate: string | null;
  sex: string | null;
  nationality: string | null;
  phone: string | null;
  passportNo: string | null;
  fin: string | null;
  linked: boolean;
  stayCount: number;
  inHouse: boolean;
};

type Group = {
  key: string;
  matchType: 'PHONE' | 'GLOBAL_PERSON_ID';
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
      <section className="space-y-3">
        {groups.map((group) => (
          <article
            key={`${group.matchType}-${group.key}`}
            className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
          >
            <h2 className="m-0 text-[13px] font-semibold text-[#34495E]">
              {group.matchType === 'PHONE' ? t('samePhone') : t('samePerson')}
              {group.matchType === 'PHONE' ? ` · ${group.key}` : ''}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.guests.map((guest) => (
                <div key={guest.id} className="space-y-2 rounded border border-[#ECEFF1] p-3 text-[13px]">
                  <div className="font-semibold text-[#2C3E50]">{guest.fullName}</div>
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
        {groups.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t('empty')}</p>
        ) : null}
      </section>
    </>
  );
}
