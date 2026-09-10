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
import { useAuth } from "@/hooks/useAuth";

type RoleRow = {
  code: string;
  name: string;
  isSystem?: boolean;
  cloneFromCode?: string | null;
  userCount?: number;
  permissions: Permission[];
};

export default function HotelAccessPage() {
  const t = useTranslations("settingsAccess");
  const tc = useTranslations("common");
  const { refresh } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [draft, setDraft] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [cloneFrom, setCloneFrom] = useState("Receptionist");

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

  async function refreshSessionAndNav() {
    await fetch("/api/auth/session/refresh-permissions", { method: "POST" });
    await refresh();
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
      const row = (await res.json()) as { permissions: Permission[] };
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

  async function createRole() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          cloneFrom,
        }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("createError"));
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
      showApiError({
        error: e instanceof Error ? e.message : t("createError"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole() {
    if (!selectedRole || selectedRole.isSystem) return;
    if (
      !window.confirm(
        t("deleteConfirm", { code: selectedRole.code, name: selectedRole.name }),
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/roles/${encodeURIComponent(selectedRole.code)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("deleteError"));
        return;
      }
      showSuccess(t("deleted"));
      setSelectedCode("");
      await loadRoles();
    } catch (e) {
      showApiError({
        error: e instanceof Error ? e.message : t("deleteError"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className={CARD_CONTAINER_CLASS + " p-4 space-y-4"}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 max-w-sm">
            <CatalogField
              kind={roles.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
              label={t("roleLabel")}
              value={selectedCode}
              onChange={(v) => setSelectedCode(String(v ?? ""))}
              options={roleOptions}
              emptyLabel={null}
              disabled={loading || busy || roles.length === 0}
              widthPreset="select"
            />
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || loading}
              onClick={() => setShowCreate((v) => !v)}
            >
              {t("createRole")}
            </button>
            {selectedRole && !selectedRole.isSystem ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || loading || (selectedRole.userCount ?? 0) > 0}
                onClick={() => void deleteRole()}
                title={
                  (selectedRole.userCount ?? 0) > 0
                    ? t("deleteBlockedUsers")
                    : undefined
                }
              >
                {t("deleteRole")}
              </button>
            ) : null}
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || loading || !selectedCode}
              onClick={() => void resetDefaults()}
            >
              {t("resetDefaults")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || loading || !selectedCode}
              onClick={() => void save()}
            >
              {busy ? tc("saving") : tc("save")}
            </button>
          </div>
        </div>

        {showCreate ? (
          <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">{t("createTitle")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted-foreground">
                  {t("newCode")}
                </span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono uppercase"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="NIGHT_MANAGER"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted-foreground">
                  {t("newName")}
                </span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("newNamePlaceholder")}
                  disabled={busy}
                />
              </label>
              <CatalogField
                kind={roles.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
                label={t("cloneFrom")}
                value={cloneFrom}
                onChange={(v) => setCloneFrom(String(v ?? ""))}
                options={cloneOptions}
                emptyLabel={null}
                disabled={busy || roles.length === 0}
                widthPreset="select"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={
                  busy || !newCode.trim() || !newName.trim() || !cloneFrom
                }
                onClick={() => void createRole()}
              >
                {t("createSubmit")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => setShowCreate(false)}
              >
                {tc("cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {selectedRole?.cloneFromCode ? (
          <p className="text-xs text-muted-foreground">
            {t("clonedFrom", { code: selectedRole.cloneFromCode })}
          </p>
        ) : null}

        {PERMISSION_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            <h3 className="text-sm font-semibold">{t(group.labelKey)}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.permissions.map((perm) => {
                const labelKey = perm.replace(/:/g, "_");
                return (
                  <label
                    key={perm}
                    className="flex items-start gap-2 rounded border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={draft.has(perm)}
                      disabled={busy || loading}
                      onChange={() => togglePermission(perm)}
                    />
                    <span>
                      <span className="font-medium">
                        {t(`perm_${labelKey}` as never)}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {perm}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
