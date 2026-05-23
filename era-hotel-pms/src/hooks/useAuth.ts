'use client';

import { useCallback, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  login: string;
  fullName: string;
  role: string;
  permissions: string[];
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        setUser(null);
        return;
      }
      setUser(await res.json());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const can = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  return { user, loading, can, refresh };
}
