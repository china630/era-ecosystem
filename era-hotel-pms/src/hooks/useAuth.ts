'use client';

import { useCallback, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  login: string;
  fullName: string;
  role: string;
  permissions: string[];
  organizationName?: string | null;
  organizationId?: string | null;
  isPlatformSuperAdmin?: boolean;
  /** OrgOwner / BUSINESS_OWNER — matrix bypass (same as API). */
  isOwner?: boolean;
  canRunElektrawebImport?: boolean;
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

  const isPlatformSuperAdmin = user?.isPlatformSuperAdmin === true;
  const isOwner = user?.isOwner === true;

  const can = useCallback(
    (permission: string) => {
      if (isPlatformSuperAdmin || isOwner) return true;
      return user?.permissions.includes(permission) ?? false;
    },
    [user, isPlatformSuperAdmin, isOwner],
  );

  const canRunElektrawebImport = user?.canRunElektrawebImport === true;

  return { user, loading, can, isPlatformSuperAdmin, canRunElektrawebImport, refresh };
}
