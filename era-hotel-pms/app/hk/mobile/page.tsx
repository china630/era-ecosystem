'use client';

import { useCallback, useEffect, useState } from 'react';

type HkTask = {
  id: string;
  roomId: string;
  taskType: string;
  status: string;
  room?: { roomNumber: string };
};

export default function HkMobilePage() {
  const [tasks, setTasks] = useState<HkTask[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/tasks');
    const json = await res.json();
    if (res.ok) setTasks(Array.isArray(json) ? json : (json.tasks ?? []));
    else setMsg(json.error ?? 'Failed to load');
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
      setMsg(json.error ?? 'Complete failed');
      return;
    }
    await load();
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-lg font-semibold">HK Mobile (v1.1)</h1>
      {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-3">
            <span className="text-sm">
              {t.room?.roomNumber ?? t.roomId} · {t.taskType} · {t.status}
            </span>
            {t.status !== 'DONE' && (
              <button
                type="button"
                className="rounded bg-[#2980B9] px-3 py-1 text-xs text-white"
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
