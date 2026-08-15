import type { ReactNode } from "react";

/** Nested layout under root — keep print pages chromeless via ClinicOpsShell. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-layout min-h-screen bg-white">{children}</div>;
}
