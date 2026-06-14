"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-context";

export function useRequireAuth() {
  const router = useRouter();
  const { ready, token, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    // Super-admin launcher works without an active organization context.
    if (!user?.organizationId && !user?.isSuperAdmin) {
      router.replace("/organizations");
    }
  }, [ready, token, user?.organizationId, user?.isSuperAdmin, router]);

  return { ready, token, user };
}
