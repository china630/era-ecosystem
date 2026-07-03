'use client';

import { useCallback, useEffect, useState } from 'react';
import { Field, FieldRow } from '@era/satellite-kit/ui';

type MenuItem = { id: string; plu: string; name: string; category: { name: string } };

export default function DailyMenuAdminPanel() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [menuRes, boardRes] = await Promise.all([
      fetch('/api/menu'),
      fetch(`/api/admin/daily-menu?date=${date}`),
    ]);
    const menu = await menuRes.json();
    const board = await boardRes.json();
    const flat: MenuItem[] = [];
    for (const cat of menu) {
      for (const item of cat.items ?? []) {
        flat.push({ ...item, category: { name: cat.name } });
      }
    }
    setAllItems(flat);
    setSelected(new Set((board.entries ?? []).map((e: { menuItemId: string }) => e.menuItemId)));
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setMsg(null);
    const res = await fetch('/api/admin/daily-menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, menuItemIds: [...selected] }),
    });
    const json = await res.json();
    setMsg(res.ok ? `Saved ${json.count} items` : json.error ?? 'Error');
  }

  async function copyYesterday() {
    const y = new Date(date);
    y.setDate(y.getDate() - 1);
    const res = await fetch('/api/admin/daily-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate: y.toISOString().slice(0, 10),
        toDate: date,
      }),
    });
    const json = await res.json();
    setMsg(res.ok ? `Copied ${json.copied}` : json.error ?? 'Error');
    await load();
  }

  return (
    <div className="space-y-4">
      <FieldRow cols={2} className="items-end">
        <Field
          label="Date"
          preset="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 pb-0.5">
          <button type="button" className="rounded bg-[#2980B9] px-3 py-1 text-white text-sm" onClick={() => void save()}>
            Save board
          </button>
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => void copyYesterday()}>
            Copy from yesterday
          </button>
          <a className="text-sm text-[#2980B9] underline self-center" href={`/menu/today?outlet=RESTAURANT`} target="_blank" rel="noreferrer">
            Guest QR menu
          </a>
        </div>
      </FieldRow>
      {msg ? <p className="text-sm text-[#2C3E50]">{msg}</p> : null}
      <ul className="max-h-[60vh] overflow-auto border rounded divide-y">
        {allItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(item.id);
                else next.delete(item.id);
                setSelected(next);
              }}
            />
            <span className="text-[#7F8C8D]">{item.category.name}</span>
            <span>{item.name}</span>
            <span className="text-[#7F8C8D]">{item.plu}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
