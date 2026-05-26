"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth-context";
import { SubscriptionProvider } from "../lib/subscription-context";
import { EarlyAccessProvider } from "./early-access/early-access-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <EarlyAccessProvider>{children}</EarlyAccessProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
