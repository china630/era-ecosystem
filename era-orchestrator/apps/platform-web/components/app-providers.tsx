"use client";

import type { ReactNode } from "react";
import { EraToastProvider } from "@era/satellite-kit/ui";
import { AuthProvider } from "@/lib/auth-context";
import { PlatformShell } from "./platform-shell";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EraToastProvider />
      <PlatformShell>{children}</PlatformShell>
    </AuthProvider>
  );
}
