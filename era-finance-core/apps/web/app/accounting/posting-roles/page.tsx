"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { PageHeader } from "../../../components/layout/page-header";

type PostingRoleRow = {
  role: string;
  templateAccountCode: string | null;
  accountCode: string | null;
  isOverride: boolean;
  overrideId: string | null;
};

function canEditPostingRoles(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "ACCOUNTANT";
}

export default function PostingRolesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const canEdit = canEditPostingRoles(user?.role);

  const [rows, setRows] = useState<PostingRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/accounting/posting-roles");
    if (!res.ok) {
      setErr(t("postingRolesPage.loadErr", "Failed to load posting roles"));
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as PostingRoleRow[];
    setRows(data);
    const next: Record<string, string> = {};
    for (const r of data) {
      next[r.role] = r.accountCode ?? "";
    }
    setDraft(next);
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  async function saveRole(role: string) {
    if (!token || !canEdit) return;
    setSavingRole(role);
    setErr(null);
    const res = await apiFetch(`/api/accounting/posting-roles/${encodeURIComponent(role)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountCode: draft[role]?.trim() ?? "" }),
    });
    setSavingRole(null);
    if (!res.ok) {
      setErr(t("postingRolesPage.saveErr", "Failed to save posting role"));
      return;
    }
    await load();
  }

  async function resetRole(role: string) {
    if (!token || !canEdit) return;
    setSavingRole(role);
    const res = await apiFetch(`/api/accounting/posting-roles/${encodeURIComponent(role)}`, {
      method: "DELETE",
    });
    setSavingRole(null);
    if (!res.ok) {
      setErr(t("postingRolesPage.saveErr", "Failed to reset posting role"));
      return;
    }
    await load();
  }

  if (!ready) return <p>{t("common.loading")}</p>;
  if (!token) return null;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={t("postingRolesPage.title", "Posting role profile")}
        subtitle={t(
          "postingRolesPage.subtitle",
          "Semantic roles for auto-journals mapped to NAS accounts for your organization kind.",
        )}
        actions={
          <Link href="/accounting/chart" className={SECONDARY_BUTTON_CLASS}>
            {t("postingRolesPage.backToChart", "Chart of accounts")}
          </Link>
        }
      />

      {!canEdit ? (
        <p className="text-sm text-slate-600">
          {t("postingRolesPage.readOnlyHint", "Only OWNER, ADMIN, or ACCOUNTANT can edit overrides.")}
        </p>
      ) : null}

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p>{t("postingRolesPage.loading", "Loading…")}</p>
      ) : (
        <div className={CARD_CONTAINER_CLASS}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-2">{t("postingRolesPage.colRole", "Role")}</th>
                <th className="text-left p-2">{t("postingRolesPage.colTemplate", "Template")}</th>
                <th className="text-left p-2">{t("postingRolesPage.colAccount", "Account code")}</th>
                {canEdit ? <th className="text-left p-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.role} className="border-t border-slate-100">
                  <td className="p-2 font-mono text-xs">{r.role}</td>
                  <td className="p-2 font-mono text-slate-500">{r.templateAccountCode ?? "—"}</td>
                  <td className="p-2">
                    {canEdit ? (
                      <input
                        className={`${INPUT_BORDERED_CLASS} font-mono w-28`}
                        value={draft[r.role] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [r.role]: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="font-mono">{r.accountCode ?? "—"}</span>
                    )}
                    {r.isOverride ? (
                      <span className="ml-2 text-xs text-amber-700">
                        {t("postingRolesPage.overrideBadge", "override")}
                      </span>
                    ) : null}
                  </td>
                  {canEdit ? (
                    <td className="p-2 space-x-2">
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={savingRole === r.role}
                        onClick={() => void saveRole(r.role)}
                      >
                        {t("postingRolesPage.save", "Save")}
                      </button>
                      {r.isOverride ? (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={savingRole === r.role}
                          onClick={() => void resetRole(r.role)}
                        >
                          {t("postingRolesPage.reset", "Reset")}
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
