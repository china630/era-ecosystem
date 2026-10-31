"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, user, token } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token || !user?.isSuperAdmin) {
      router.replace("/login");
    }
  }, [ready, token, user, router]);

  if (!ready || !token || !user?.isSuperAdmin) return null;
  return <>{children}</>;
}
