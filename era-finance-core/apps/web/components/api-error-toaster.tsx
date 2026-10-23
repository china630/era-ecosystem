"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { securityBlockText } from "../lib/api-error-text";

type ApiErrorDetail = {
  status: number;
  message: string;
  code?: string;
};

/**
 * Listens for API errors from the API client and shows a Sonner toast.
 * Platform security codes use a localized sentence instead of the raw English body.
 */
export function ApiErrorToaster() {
  const { t } = useTranslation();

  useEffect(() => {
    const onErr = (ev: Event) => {
      const detail = (ev as CustomEvent<ApiErrorDetail>).detail;
      if (!detail || typeof detail.message !== "string") return;
      const local = securityBlockText(t, detail.code);
      toast.error(local ? t("common.securityBlockTitle") : t("common.apiErrorTitle"), {
        description: local ?? `${detail.status}: ${detail.message}`,
        duration: 8000,
      });
    };
    window.addEventListener("erafinance:api-error", onErr);
    return () => window.removeEventListener("erafinance:api-error", onErr);
  }, [t]);

  return null;
}
