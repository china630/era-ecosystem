'use client';

import { useCallback, useEffect, useState } from 'react';
import { showApiError } from '@era/satellite-kit/ui';

export function useGuestCrmList(apiUrl: string) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, 'Load failed');
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : 'Load failed' });
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, reload: load };
}
