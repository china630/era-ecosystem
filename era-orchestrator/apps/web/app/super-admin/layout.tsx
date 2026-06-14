"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../lib/auth-context";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user?.isSuperAdmin) {
      router.replace("/");
    }
  }, [ready, user, router]);

  if (!ready || !user?.isSuperAdmin) return null;

  return <>{children}</>;
}
