'use client';

import { useCallback, useEffect, useState } from 'react';

export function useGuestCrmList(apiUrl: string) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(apiUrl);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(typeof data.error === 'string' ? data.error : 'Load failed');
      return;
    }
    setMsg(null);
    setRows(Array.isArray(data) ? data : []);
  }, [apiUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, msg, loading, reload: load };
}
