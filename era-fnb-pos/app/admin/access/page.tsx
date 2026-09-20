"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import {
  PERMISSION_GROUPS,
  type Permission,
} from "@/lib/auth/permissions";

type RoleRow = {
  code: string;
  name: string;
  isSystem?: boolean;
  cloneFromCode?: string | null;
  userCount?: number;
  permissions: Permission[];
};

export default function FnbAccessPage() {
  const t = useTranslations("settingsAccess");
  const tc = useTranslations("common");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [draft, setDraft] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [cloneFrom, setCloneFrom] = useState("FB_MANAGER");

  const selectedRole = roles.find((r) => r.code === selectedCode);

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        value: r.code,
        label: `${r.name} (${r.code})${r.isSystem ? "" : " *"}`,
      })),
    [roles],
  );

  const cloneOptions = useMemo(
    () =>
      roles.map((r) => ({
        value: r.code,
        label: `${r.name} (${r.code})`,
      })),
    [roles],
  );

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
      setSelectedCode((prev) => {
        if (prev && rows.some((r) => r.code === prev)) return prev;
        return rows[0]?.code ?? "";
      });
      if (rows.length > 0 && !rows.some((r) => r.code === cloneFrom)) {
        setCloneFrom(rows[0]!.code);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
    } finally {
      setLoading(false);
    }
  }, [cloneFrom, tc]);

  const loadRoleDraft = useCallback(
    async (code: string) => {
      if (!code) return;
      try {
        const res = await fetch(
          `/api/admin/roles/${encodeURIComponent(code)}/permissions`,
        );
        if (!res.ok) {
          showApiError(await res.json().catch(() => ({})), tc("loadError"));
          return;
        }
        const row = (await res.json()) as { permissions: Permission[] };
        setDraft(new Set(row.permissions));
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
      }
    },
    [tc],
  );

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (selectedCode) void loadRoleDraft(selectedCode);
  }, [selectedCode, loadRoleDraft]);

  async function refreshSession() {
    await fetch("/api/auth/session/refresh-permissions", { method: "POST" });
    showSuccess(t("sessionRefreshed"));
  }

  function togglePermission(code: Permission) {
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
      await refreshSession();
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
      const row = (await res.json()) as { permissions: Permission[] };
      setDraft(new Set(row.permissions));
      showSuccess(t("resetDone"));
      await loadRoles();
      await refreshSession();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("saveError") });
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          name: newName,
          cloneFrom,
        }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveError"));
        return;
      }
      const created = (await res.json()) as RoleRow;
      showSuccess(t("created"));
      setShowCreate(false);
      setNewCode("");
      setNewName("");
      await loadRoles();
      setSelectedCode(created.code);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("saveError") });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole() {
    if (!selectedRole || selectedRole.isSystem) return;
    if ((selectedRole.userCount ?? 0) > 0) {
      showApiError({ error: t("deleteInUse") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/roles/${encodeURIComponent(selectedRole.code)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveError"));
        return;
      }
      showSuccess(t("deleted"));
      setSelectedCode("");
      await loadRoles();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("saveError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="text-sm text-[var(--era-muted)]">{tc("loading")}</p>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("role")}
                  value={selectedCode}
                  onChange={(v) => setSelectedCode(String(v))}
                  options={roleOptions}
                />
              </div>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => setShowCreate((s) => !s)}
              >
                {t("clone")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !selectedCode}
                onClick={() => void save()}
              >
                {t("save")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || !selectedCode}
                onClick={() => void resetDefaults()}
              >
                {t("reset")}
              </button>
              {selectedRole && !selectedRole.isSystem ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void deleteRole()}
                >
                  {t("delete")}
                </button>
              ) : null}
            </div>

            {showCreate ? (
              <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span>{t("newCode")}</span>
                  <input
                    className="rounded border px-2 py-1.5"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("newName")}</span>
                  <input
                    className="rounded border px-2 py-1.5"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("cloneFrom")}
                  value={cloneFrom}
                  onChange={(v) => setCloneFrom(String(v))}
                  options={cloneOptions}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy || !newCode || !newName}
                  onClick={() => void createRole()}
                >
                  {t("create")}
                </button>
              </div>
            ) : null}

            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.id}>
                  <h3 className="mb-2 text-sm font-semibold">
                    {t(group.labelKey)}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={draft.has(p)}
                          onChange={() => togglePermission(p)}
                        />
                        <span className="font-mono text-xs">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
