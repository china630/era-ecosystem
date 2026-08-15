"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FORM_INPUT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  parseApiError,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";
import { REFERRAL_STORAGE_KEY } from "../../lib/referral-storage";

export function CreateOrganizationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("organizations");
  const tCommon = useTranslations("common");
  const { login, token } = useAuth();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setTaxId("");
    setBusy(false);
    setError(null);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    const digits = taxId.replace(/\D/g, "").slice(0, 10);
    if (!name.trim() || digits.length !== 10) {
      setError(t("invalidVoen"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let referralCode: string | undefined;
      try {
        referralCode = sessionStorage.getItem(REFERRAL_STORAGE_KEY) ?? undefined;
      } catch {
        referralCode = undefined;
      }
      const res = await orchFetch("/auth/register-organization", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          taxId: digits,
          referralCode: referralCode?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("createFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        claims: {
          sub: string;
          email: string;
          organizationId: string;
          role: string;
          isSuperAdmin?: boolean;
        };
      };
      try {
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {
        // ignore
      }
      login(data.accessToken, {
        id: data.claims.sub,
        email: data.claims.email,
        organizationId: data.claims.organizationId,
        role: data.claims.role,
        isSuperAdmin: data.claims.isSuperAdmin,
      }, data.refreshToken);
      onClose();
      router.push("/workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title={t("createTitle")}
      subtitle={t("createHint")}
      onClose={onClose}
      closeLabel={tCommon("cancel")}
      maxWidthClass="max-w-xl"
      footer={
        <ModalFooter
          formId="create-org-form"
          onCancel={onClose}
          busy={busy}
          cancelLabel={tCommon("cancel")}
          submitLabel={t("createSubmit")}
        />
      }
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <form id="create-org-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="block">
          <span className={MODAL_FIELD_LABEL_CLASS}>{t("orgName")}</span>
          <input
            className={`${FORM_INPUT_CLASS} mt-1.5`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="organization"
          />
        </label>
        <label className="block">
          <span className={MODAL_FIELD_LABEL_CLASS}>{t("taxId")}</span>
          <input
            className={`${FORM_INPUT_CLASS} mt-1.5`}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            pattern="\d{10}"
            required
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-[#7F8C8D]">{t("voenHint")}</p>
        </label>
      </form>
    </ModalShell>
  );
}
