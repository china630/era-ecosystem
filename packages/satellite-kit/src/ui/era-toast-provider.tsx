"use client";

import { Toaster } from "sonner";

/** Mount once per app — top-right toast for API errors and notifications. */
export function EraToastProvider() {
  return <Toaster richColors position="top-right" closeButton />;
}
