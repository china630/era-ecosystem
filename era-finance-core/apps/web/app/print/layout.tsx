import type { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-layout min-h-screen bg-white">{children}</div>;
}
