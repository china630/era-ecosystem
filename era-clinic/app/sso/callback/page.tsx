"use client";

import { Suspense } from "react";
import { SsoCallbackPage, TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";

export default function Page() {
  return (
    <Suspense fallback={<p className={`p-6 text-sm ${TEXT_MUTED_CLASS}`}>Signing you in…</p>}>
      <SsoCallbackPage />
    </Suspense>
  );
}
