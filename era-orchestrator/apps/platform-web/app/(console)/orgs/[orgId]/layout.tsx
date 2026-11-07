"use client";

import { OrgShell } from "./org-shell";

export default function OrgDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrgShell>{children}</OrgShell>;
}
