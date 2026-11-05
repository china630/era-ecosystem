"use client";

import { useEffect } from "react";
import { platformConsoleUrl } from "../../lib/platform-origin";

/**
 * Cutover: vendor SuperAdmin UI lives on platform-web.
 * Client /super-admin/* redirects to platform.era-365.online short paths.
 */
export default function SuperAdminLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const path =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    window.location.replace(platformConsoleUrl(path));
  }, []);

  return (
    <p className="p-6 text-sm text-[#7F8C8D]">Redirecting to platform console…</p>
  );
}
