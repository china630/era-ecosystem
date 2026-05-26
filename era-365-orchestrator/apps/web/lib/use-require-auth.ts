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
    } else if (!user?.organizationId) {
      router.replace("/register-org");
    }
  }, [ready, token, user?.organizationId, router]);

  return { ready, token, user };
}
