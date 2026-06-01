"use client";

import type { ReactNode } from "react";
import { EraToastProvider } from "./era-toast-provider";

/** Client-only providers shared by industry satellites (toast, etc.). */
export function SatelliteAppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <EraToastProvider />
      {children}
    </>
  );
}
