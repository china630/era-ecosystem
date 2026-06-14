"use client";

import type { ReactNode } from "react";
import { EraToastProvider } from "@era/satellite-kit/ui";
import { AuthProvider } from "../lib/auth-context";
import { SubscriptionProvider } from "../lib/subscription-context";
import { EarlyAccessProvider } from "./early-access/early-access-context";
import { CreateOrganizationProvider } from "./organizations/create-organization-context";
import { ControlPlaneShell } from "./control-plane-shell";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <EarlyAccessProvider>
          <CreateOrganizationProvider>
            <EraToastProvider />
            <ControlPlaneShell>{children}</ControlPlaneShell>
          </CreateOrganizationProvider>
        </EarlyAccessProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
