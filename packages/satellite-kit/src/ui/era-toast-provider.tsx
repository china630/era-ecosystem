"use client";

import { Toaster } from "sonner";

/** Mount once per app — top-right toast for API errors and notifications. */
export function EraToastProvider() {
  return (
    <Toaster
      richColors
      position="top-right"
      closeButton
      expand
      visibleToasts={8}
      gap={12}
      toastOptions={{
        // Saxla (and any multi-line) outcome toasts use \\n between SKU rows.
        style: { whiteSpace: "pre-line" },
      }}
    />
  );
}
