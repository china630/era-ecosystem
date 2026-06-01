"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { SsoCallbackPage } from "@era/satellite-kit/ui";

function SigningInFallback() {
  const t = useTranslations("sso");
  return <p className="p-6 text-sm text-[#7F8C8D]">{t("signingIn")}</p>;
}

export default function Page() {
  return (
    <Suspense fallback={<SigningInFallback />}>
      <SsoCallbackPage />
    </Suspense>
  );
}
