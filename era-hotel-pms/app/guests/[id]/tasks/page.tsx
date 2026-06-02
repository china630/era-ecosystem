'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

type Task = { id: string; title: string; status: string; dueAt: string | null };

export default function GuestTasksPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Task[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guests/${id}/tasks`);
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

  async function addTask() {
    const title = window.prompt(t('tasksPage.prompt'));
    if (!title?.trim()) return;
    const res = await fetch(`/api/guests/${id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
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
      <PageHeader title={t('tasksPage.title')} />
      <StatusMessage>{msg}</StatusMessage>
      <button type="button" className={`${PRIMARY_BUTTON_CLASS} mb-4`} onClick={() => void addTask()}>
        {t('tasksPage.add')}
      </button>
      <ul className="space-y-2 text-[13px]">
        {rows.map((task) => (
          <li key={task.id} className="flex justify-between rounded-lg border border-[#D5DADF] p-3">
            <span>{task.title}</span>
            <span className="text-[#7F8C8D]">{task.status}</span>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-[#7F8C8D]">{tc('empty')}</li> : null}
      </ul>
    </AppShell>
  );
}
