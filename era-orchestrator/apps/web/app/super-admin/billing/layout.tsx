"use client";

import { BillingProvider } from "./billing-context";

export default function SuperAdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BillingProvider>{children}</BillingProvider>;
}
