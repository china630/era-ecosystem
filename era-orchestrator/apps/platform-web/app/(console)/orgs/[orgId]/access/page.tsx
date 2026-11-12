"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import { useOrgShell } from "../org-shell";

type AccessRow = {
  code: string;
  group: "bank" | "gov" | "other";
  active: boolean;
  hasSecret: boolean;
  fields: { key: string; max: number }[];
  saved: boolean;
  publicFields: Record<string, string>;
  secretSet: boolean;
};

export default function OrgAccessPage() {
  const { orgId, setFlash } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgAccess");
  const [items, setItems] = useState<AccessRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/access`, { token });
    if (!res.ok) {
      setFlash(t("loadFailed", { status: res.status }));
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { items: AccessRow[] };
    setItems(body.items);
    const next: Record<string, Record<string, string>> = {};
    for (const row of body.items) next[row.code] = { ...row.publicFields };
    setDrafts(next);
    setLoading(false);
  }, [token, orgId, setFlash, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (row: AccessRow) => {
    if (!token) return;
    setBusy(row.code);
    const secret = secrets[row.code]?.trim();
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/access/${row.code}`, {
      token,
      method: "PUT",
      body: JSON.stringify({
        publicFields: drafts[row.code] ?? {},
        ...(secret ? { secret } : {}),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      const detail = Array.isArray(body?.message) ? body?.message[0] : body?.message;
      setFlash(detail ? t("saveFailedDetail", { status: res.status, detail }) : t("saveFailed", { status: res.status }));
      return;
    }
    setSecrets((prev) => ({ ...prev, [row.code]: "" }));
    setFlash(t("saved"));
    await reload();
  };

  const check = async (row: AccessRow) => {
    if (!token) return;
    setBusy(row.code);
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/access/${row.code}/check`, {
      token,
      method: "POST",
    });
    setBusy(null);
    if (!res.ok) {
      setFlash(t("checkFailed", { status: res.status }));
      return;
    }
    setFlash(t("storedNotCalled"));
  };

  const groups = ["bank", "gov", "other"] as const;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("intro")}</p>
      {loading ? <p className="text-sm">{t("loading")}</p> : null}
      {groups.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-semibold text-[#34495E]">{t(`group.${group}`)}</h2>
          {items
            .filter((row) => row.group === group)
            .map((row) => (
              <article key={row.code} className={`${CARD_CONTAINER_CLASS} space-y-3`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-[#34495E]">{t(`connector.${row.code}`)}</h3>
                  {row.secretSet ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                      {t("secretSet")}
                    </span>
                  ) : null}
                  {!row.active ? (
                    <span className="text-xs text-[#7F8C8D]">{t("inactive")}</span>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {row.fields.map((field) => (
                    <label key={field.key} className="block text-xs text-[#7F8C8D]">
                      {t(`field.${field.key}`)}
                      <input
                        className="mt-1 w-full rounded border border-[#D5D8DC] px-2 py-1.5 text-sm text-[#34495E] disabled:bg-[#F4F6F7]"
                        maxLength={field.max}
                        disabled={!row.active}
                        value={drafts[row.code]?.[field.key] ?? ""}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.code]: { ...prev[row.code], [field.key]: event.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                  {row.hasSecret ? (
                    <label className="block text-xs text-[#7F8C8D]">
                      {t("secret")}
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="mt-1 w-full rounded border border-[#D5D8DC] px-2 py-1.5 text-sm text-[#34495E] disabled:bg-[#F4F6F7]"
                        disabled={!row.active}
                        placeholder={row.secretSet ? t("secretKeep") : ""}
                        value={secrets[row.code] ?? ""}
                        onChange={(event) =>
                          setSecrets((prev) => ({ ...prev, [row.code]: event.target.value }))
                        }
                      />
                    </label>
                  ) : null}
                </div>
                {row.active ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy === row.code}
                      onClick={() => void save(row)}
                    >
                      {t("save")}
                    </button>
                    {row.saved ? (
                      <button
                        type="button"
                        className={GHOST_BUTTON_CLASS}
                        disabled={busy === row.code}
                        onClick={() => void check(row)}
                      >
                        {t("check")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
