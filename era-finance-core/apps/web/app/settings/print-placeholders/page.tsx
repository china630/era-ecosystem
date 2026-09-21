"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
  FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
  PRINT_BLANK_FINANCE_INVOICE_COMMERCIAL,
} from "@era/satellite-kit/print";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../../lib/role-utils";
import { CARD_CONTAINER_CLASS } from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import type { ExtraFieldDefRow } from "../../../components/extra-fields/extra-attributes-block";

/**
 * Read-only placeholder catalog for FINANCE_INVOICE_COMMERCIAL (W3).
 * Proves whitelist exists without template upload UI.
 */
export default function PrintPlaceholdersSettingsPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { user } = useAuth();
  const perms = useOrgPermissions();
  const canView = perms.can(CP_PERMISSION.ADMIN_ORG_SETTINGS);
  const [extraKeys, setExtraKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/extra-fields?entityType=FINANCE_INVOICE");
    if (res.ok) {
      const list = (await res.json()) as ExtraFieldDefRow[];
      setExtraKeys(
        Array.isArray(list)
          ? list.filter((r) => r.active !== false).map((r) => `extra.${r.key}`)
          : [],
      );
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (ready && token && canView) void load();
  }, [ready, token, load, canView]);

  if (!ready || !token) return null;
  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-[#7F8C8D]">{t("printPlaceholders.adminOnly")}</p>
      </div>
    );
  }

  const base = [...FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST];
  const lines = [...FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t("printPlaceholders.pageTitle")}
        subtitle={t("printPlaceholders.pageHint", {
          blank: PRINT_BLANK_FINANCE_INVOICE_COMMERCIAL,
        })}
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <h2 className="m-0 text-[15px] font-semibold text-[#34495E]">
          {t("printPlaceholders.baseKeys")}
        </h2>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
        ) : (
          <ul className="m-0 list-disc space-y-1 pl-5 font-mono text-[12px] text-[#34495E]">
            {base.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <h2 className="m-0 text-[15px] font-semibold text-[#34495E]">
          {t("printPlaceholders.lineKeys")}
        </h2>
        <ul className="m-0 list-disc space-y-1 pl-5 font-mono text-[12px] text-[#34495E]">
          {lines.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <h2 className="m-0 text-[15px] font-semibold text-[#34495E]">
          {t("printPlaceholders.extraKeys")}
        </h2>
        {extraKeys.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("printPlaceholders.noExtras")}</p>
        ) : (
          <ul className="m-0 list-disc space-y-1 pl-5 font-mono text-[12px] text-[#34495E]">
            {extraKeys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
