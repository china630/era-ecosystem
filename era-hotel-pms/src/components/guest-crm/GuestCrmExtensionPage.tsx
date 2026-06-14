'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@era/satellite-kit/ui';
import { MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useTranslations } from 'next-intl';

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
  const tc = useTranslations('crmPages');
  const [data, setData] = useState<ExtensionData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/guests/${guestId}/crm-extension`);
    if (res.ok) setData(await res.json());
  }, [guestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<ExtensionData>) {
    const res = await fetch(`/api/guests/${guestId}/crm-extension`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setMsg(res.ok ? tc('saved') : tc('saveFailed'));
    await load();
  }

  async function addItem() {
    if (!data || !input.trim()) return;
    if (field === 'interests') {
      await save({ interests: [...data.interests, input.trim()] });
    } else if (field === 'socialMedia' && socialMode) {
      const [platform, handle] = input.split(':').map((s) => s.trim());
      if (!platform || !handle) return;
      await save({ socialMedia: { ...data.socialMedia, [platform]: handle } });
    } else if (field === 'generalCrmNotes') {
      await save({ generalCrmNotes: input });
    }
    setInput('');
  }

  return (
    <AppShell maxWidthClass="max-w-xl">
      <PageHeader
        title={tc(titleKey)}
        leading={
          <Link href={`/guests?highlight=${guestId}`} className="text-[13px] text-[#2980B9] hover:underline">
            {t('backToGuest')}
          </Link>
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <PageSection className="space-y-3 text-[13px]">
        {field === 'interests' &&
          data?.interests.map((item) => <div key={item} className="rounded border border-[#ECEFF1] p-2">{item}</div>)}
        {field === 'socialMedia' &&
          Object.entries(data?.socialMedia ?? {}).map(([k, v]) => (
            <div key={k} className="rounded border border-[#ECEFF1] p-2">
              <strong>{k}</strong>: {v}
            </div>
          ))}
        {field === 'generalCrmNotes' && (
          <p className="whitespace-pre-wrap rounded border border-[#ECEFF1] p-3">{data?.generalCrmNotes || '—'}</p>
        )}
        {multiline ? (
          <textarea
            className={`min-h-24 w-full ${MODAL_INPUT_CLASS}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            className={`w-full ${MODAL_INPUT_CLASS}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void addItem()}>
          {tc('add')}
        </button>
      </PageSection>
    </AppShell>
  );
}
