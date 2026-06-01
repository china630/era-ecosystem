"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GHOST_BUTTON_CLASS } from "@era/satellite-kit/ui";
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

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/super-admin" className={GHOST_BUTTON_CLASS}>
          Hub
        </Link>
        <Link href="/super-admin/billing" className={GHOST_BUTTON_CLASS}>
          Billing
        </Link>
        <Link href="/super-admin/mdm" className={GHOST_BUTTON_CLASS}>
          MDM
        </Link>
        <Link href="/super-admin/mdm/companies" className={GHOST_BUTTON_CLASS}>
          MDM companies
        </Link>
        <Link href="/super-admin/early-access" className={GHOST_BUTTON_CLASS}>
          Early access
        </Link>
        <Link href="/super-admin/security" className={GHOST_BUTTON_CLASS}>
          Security
        </Link>
        <Link href="/" className={GHOST_BUTTON_CLASS}>
          ← Launcher
        </Link>
      </nav>
      {children}
    </div>
  );
}
