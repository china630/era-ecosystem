"use client";

import { Suspense } from "react";
import { SsoCallbackPage } from "@era/satellite-kit/ui";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#7F8C8D]">Signing you in…</p>}>
      <SsoCallbackPage />
    </Suspense>
  );
}
