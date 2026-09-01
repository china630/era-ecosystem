"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import {
  CONFIGURABLE_CLINIC_ROLES,
  PERMISSION_GROUPS,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";

type RoleRow = {
  code: string;
  name: string;
  permissions: ClinicPermission[];
};

export default function ClinicAdminAccessPage() {
  const t = useTranslations("adminAccess");
  const tc = useTranslations("common");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>(CONFIGURABLE_CLINIC_ROLES[0]);
  const [draft, setDraft] = useState<Set<ClinicPermission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedRole = roles.find((r) => r.code === selectedCode);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("loadError"));
        return;
      }
      const rows = (await res.json()) as RoleRow[];
      setRoles(rows);
      if (rows.length > 0 && !rows.some((r) => r.code === selectedCode)) {
        setSelectedCode(rows[0]!.code);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
    } finally {
      setLoading(false);
    }
  }, [selectedCode, tc]);

  const loadRoleDraft = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(code)}/permissions`);
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("loadError"));
        return;
      }
      const row = (await res.json()) as { permissions: ClinicPermission[] };
      setDraft(new Set(row.permissions));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
    }
  }, [tc]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (selectedCode) void loadRoleDraft(selectedCode);
  }, [selectedCode, loadRoleDraft]);

  const grouped = useMemo(() => PERMISSION_GROUPS, []);

  async function refreshSessionAndNav() {
    await fetch("/api/auth/session/refresh-permissions", { method: "POST" });
    window.dispatchEvent(new Event("clinic-auth-refresh"));
    showSuccess(t("sessionRefreshed"));
  }

  function togglePermission(code: ClinicPermission) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function save() {
    if (!selectedCode) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/roles/${encodeURIComponent(selectedCode)}/permissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: [...draft] }),
        },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveError"));
        return;
      }
      showSuccess(t("saved"));
      await loadRoles();
      await refreshSessionAndNav();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("saveError") });
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    if (!selectedCode) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/roles/${encodeURIComponent(selectedCode)}/permissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetToDefaults: true }),
        },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveError"));
        return;
      }
      const row = (await res.json()) as { permissions: ClinicPermission[] };
      setDraft(new Set(row.permissions));
      showSuccess(t("resetDone"));
      await loadRoles();
      await refreshSessionAndNav();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("saveError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className={CARD_CONTAINER_CLASS + " p-4 space-y-4"}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted-foreground">{t("roleLabel")}</span>
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[12rem]"
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              disabled={loading || busy}
            >
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || loading}
              onClick={() => void resetDefaults()}
            >
              {t("resetDefaults")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || loading}
              onClick={() => void save()}
            >
              {busy ? tc("saving") : tc("save")}
            </button>
          </div>
        </div>

        {selectedRole ? (
          <p className="text-sm text-muted-foreground">{t("permissionCount", { count: draft.size })}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.id}>
                <h2 className="text-sm font-semibold mb-2">{t(`groups.${group.id}`)}</h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.permissions.map((perm) => (
                    <li key={perm}>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={draft.has(perm)}
                          onChange={() => togglePermission(perm)}
                          disabled={busy}
                        />
                        <span>
                          <span className="font-medium text-sm">
                            {(() => {
                              const key = `permissions.${perm.replace(/\./g, "_")}` as const;
                              return t.has(key) ? t(key) : perm;
                            })()}
                          </span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {perm}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
