'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

type Note = { id: string; noteType: string; text: string; updatedAt: string };

export default function GuestNotesPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Note[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guests/${id}/notes`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNote() {
    const text = window.prompt(t('notesPage.prompt'));
    if (!text?.trim()) return;
    const res = await fetch(`/api/guests/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMsg(data.error ?? tc('failed'));
      return;
    }
    await load();
  }

  return (
    <AppShell maxWidthClass="max-w-[800px]">
      <PageHeader title={t('notesPage.title')} />
      <StatusMessage>{msg}</StatusMessage>
      <button type="button" className={`${PRIMARY_BUTTON_CLASS} mb-4`} onClick={() => void addNote()}>
        {t('notesPage.add')}
      </button>
      <ul className="space-y-2 text-[13px]">
        {rows.map((n) => (
          <li key={n.id} className="rounded-lg border border-[#D5DADF] p-3">
            <span className="text-[11px] text-[#7F8C8D]">{n.noteType}</span>
            <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-[#7F8C8D]">{tc('empty')}</li> : null}
      </ul>
    </AppShell>
  );
}
