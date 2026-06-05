"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth, type OrgSummary } from "../../lib/auth-context";
import { MODAL_DIALOG_CONTENT_CLASS, PRIMARY_BUTTON_CLASS } from "../../lib/design-system";

/** Блокирующий выбор org: без overlay/Escape закрытия (FEAT-FC-UX-002). */
export function CompanySelectBlockingModal({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { organizations, switchOrganization } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function pick(org: OrgSummary) {
    setBusyId(org.id);
    try {
      await switchOrganization(org.id);
      router.refresh();
      router.push("/");
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-select-blocking-title"
      >
        <header>
          <h2
            id="company-select-blocking-title"
            className="m-0 text-lg font-semibold text-[#34495E]"
          >
            {t("companiesPage.selectCompanyTitle", { defaultValue: "Şirkət seçin" })}
          </h2>
          <p className="mt-2 text-[13px] text-[#7F8C8D]">
            {t("companiesPage.selectCompanyHint", {
              defaultValue: "Davam etmək üçün aktiv şirkəti seçməlisiniz.",
            })}
          </p>
        </header>
        <ul className="m-0 mt-4 max-h-[min(50vh,20rem)] list-none space-y-2 overflow-y-auto p-0">
          {organizations.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                className={`${PRIMARY_BUTTON_CLASS} w-full justify-start text-left`}
                disabled={busyId === org.id}
                onClick={() => void pick(org)}
              >
                <span className="block font-semibold">{org.name}</span>
                <span className="block text-[12px] font-normal opacity-80">
                  {org.taxId} · {org.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
