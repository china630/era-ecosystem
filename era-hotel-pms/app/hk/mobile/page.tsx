'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

type HkTask = {
  id: string;
  roomId: string;
  taskType: string;
  status: string;
  room?: { roomNumber: string };
};

export default function HkMobilePage() {
  const [tasks, setTasks] = useState<HkTask[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/tasks');
    const json = await res.json();
    if (res.ok) setTasks(Array.isArray(json) ? json : (json.tasks ?? []));
    else showApiError(json, 'Failed to load');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(id: string) {
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: id }),
    });
    if (!res.ok) {
      const json = await res.json();
      showApiError(json, 'Complete failed');
      return;
    }
    await load();
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-lg font-semibold">HK Mobile (v1.1)</h1>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-3">
            <span className="text-sm">
              {t.room?.roomNumber ?? t.roomId} · {t.taskType} · {t.status}
            </span>
            {t.status !== 'DONE' && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => complete(t.id)}
              >
                Done
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
