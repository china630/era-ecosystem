"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

export default function AccountPasswordPage() {
  const t = useTranslations("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showApiError({ error: t("mismatch") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showApiError(body, t("failed"));
        return;
      }
      showSuccess(t("success"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showApiError({ error: t("failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <form className={FORM_STACK_CLASS} onSubmit={(e) => void onSubmit(e)}>
        <Field
          label={t("current")}
          preset="shortText"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Field
          label={t("newPassword")}
          preset="shortText"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Field
          label={t("confirm")}
          preset="shortText"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
          {busy ? t("busy") : t("submit")}
        </button>
      </form>
    </div>
  );
}
