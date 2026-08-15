'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldTextarea,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type ExtensionData = {
  interests: string[];
  socialMedia: Record<string, string>;
  generalCrmNotes: string;
};

type Props = {
  titleKey: string;
  field: keyof ExtensionData;
  placeholder?: string;
  multiline?: boolean;
  socialMode?: boolean;
};

export function GuestCrmExtensionPage({
  titleKey,
  field,
  placeholder,
  multiline,
  socialMode,
}: Props) {
  const params = useParams();
  const guestId = params.id as string;
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [data, setData] = useState<ExtensionData | null>(null);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/guests/${guestId}/crm-extension`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json, tc('loadError'));
        return;
      }
      setData(json);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [guestId, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<ExtensionData>) {
    try {
      const res = await fetch(`/api/guests/${guestId}/crm-extension`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  async function addItem() {
    if (!data || !input.trim()) return;
    if (field === 'interests') {
      await save({ interests: [...data.interests, input.trim()] });
    } else if (field === 'socialMedia' && socialMode) {
      const [platform, handle] = input.split(':').map((s) => s.trim());
      if (!platform || !handle) {
        showApiError({ error: tc('required') });
        return;
      }
      await save({ socialMedia: { ...data.socialMedia, [platform]: handle } });
    } else if (field === 'generalCrmNotes') {
      await save({ generalCrmNotes: input });
    }
    setInput('');
  }

  const interestItems = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    const list = data?.interests ?? [];
    if (!needle) return list;
    return list.filter((item) => item.toLowerCase().includes(needle));
  }, [data?.interests, debouncedQ]);

  const socialItems = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    const entries = Object.entries(data?.socialMedia ?? {});
    if (!needle) return entries;
    return entries.filter(([k, v]) => `${k} ${v}`.toLowerCase().includes(needle));
  }, [data?.socialMedia, debouncedQ]);

  const isList = field === 'interests' || field === 'socialMedia';

  return (
    <>
      <PageHeader
        title={t(titleKey as 'crmPages.interestsTitle')}
        leading={
          <Link href={`/guests?highlight=${guestId}`} className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />

      {isList ? (
        <EraListFilterBar
          resetLabel={tc('filterReset')}
          onReset={() => setQ('')}
        >
          <Field
            label={tc('search')}
            preset="longText"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </EraListFilterBar>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-3 text-[13px]`}>
        {field === 'interests'
          ? interestItems.map((item) => (
              <div key={item} className="rounded border border-[#ECEFF1] p-2">
                {item}
              </div>
            ))
          : null}
        {field === 'socialMedia'
          ? socialItems.map(([k, v]) => (
              <div key={k} className="rounded border border-[#ECEFF1] p-2">
                <strong>{k}</strong>: {v}
              </div>
            ))
          : null}
        {field === 'generalCrmNotes' ? (
          <p className="whitespace-pre-wrap rounded border border-[#ECEFF1] p-3">
            {data?.generalCrmNotes || '—'}
          </p>
        ) : null}

        {multiline ? (
          <FieldTextarea
            label={t('crmPages.add')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <Field
            label={t('crmPages.add')}
            preset="longText"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void addItem()}>
          {t('crmPages.add')}
        </button>
      </div>
    </>
  );
}
