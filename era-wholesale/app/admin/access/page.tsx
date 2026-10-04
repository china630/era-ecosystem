"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  OPS_NAV_PROFILE_REFRESH_EVENT,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { ACCESS_MANAGER_ROLE, PERMISSION_GROUPS, type Permission } from "@/lib/auth/permissions";

type RoleRow = {
  code: string;
  name: string;
  isSystem?: boolean;
  cloneFromCode?: string | null;
  userCount?: number;
  permissions: Permission[];
};

type UserRow = {
  id: string;
  login: string;
  fullName: string;
  status: string;
  roleCode: string;
};

export default function AccessPage() {
  const t = useTranslations("settingsAccess");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [draft, setDraft] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string>(ACCESS_MANAGER_ROLE);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleCode, setAssignRoleCode] = useState("");

  const selectedRole = roles.find((r) => r.code === selectedCode);

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        value: r.code,
        label: `${r.name} (${r.code})${r.isSystem ? "" : " *"}`,
      })),
    [roles],
  );

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.fullName || u.login} (${u.login}) — ${u.roleCode}`,
      })),
    [users],
  );

  const permLabel = useCallback(
    (p: Permission) => {
      const key = `perms.${p.replace(/[:.]/g, "_")}`;
      return t.has(key as "title") ? t(key as "title") : p;
    },
    [t],
  );

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("loadFailed"));
        return;
      }
      const rows = (await res.json()) as RoleRow[];
      setRoles(rows);
      setSelectedCode((prev) => (prev && rows.some((r) => r.code === prev) ? prev : rows[0]?.code ?? ""));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("loadFailed") });
    }
  }, [t]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("loadFailed"));
        return;
      }
      setUsers((await res.json()) as UserRow[]);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("loadFailed") });
    }
  }, [t]);

  useEffect(() => {
    void Promise.all([loadRoles(), loadUsers()]).finally(() => setLoading(false));
  }, [loadRoles, loadUsers]);

  useEffect(() => {
    setDraft(new Set(selectedRole?.permissions ?? []));
  }, [selectedRole]);

  async function refreshSession() {
    await fetch("/api/auth/session/refresh-permissions", { method: "POST" });
    window.dispatchEvent(new Event(OPS_NAV_PROFILE_REFRESH_EVENT));
  }

  function togglePermission(code: Permission) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function patchPermissions(body: Record<string, unknown>, okMessage: string) {
    if (!selectedCode) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(selectedCode)}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("saveFailed"));
        return;
      }
      showSuccess(okMessage);
      await loadRoles();
      await refreshSession();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("saveFailed") });
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
        body: JSON.stringify({ code: newCode, name: newName, cloneFrom }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("saveFailed"));
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
      showApiError({ error: e instanceof Error ? e.message : t("saveFailed") });
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
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(selectedRole.code)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("saveFailed"));
        return;
      }
      showSuccess(t("deleted"));
      setSelectedCode("");
      await loadRoles();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }

  async function assignRole() {
    if (!assignUserId || !assignRoleCode) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignUserId, roleCode: assignRoleCode }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("saveFailed"));
        return;
      }
      showSuccess(t("assigned"));
      await Promise.all([loadUsers(), loadRoles()]);
      await refreshSession();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="text-sm text-[var(--era-muted)]">{t("loading")}</p>
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
                onClick={() => void patchPermissions({ permissions: [...draft] }, t("saved"))}
              >
                {t("save")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || !selectedCode}
                onClick={() => void patchPermissions({ resetToDefaults: true }, t("resetDone"))}
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
              <div className="grid gap-3 rounded border border-[var(--era-border)] p-3 md:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  <span>{t("newCode")}</span>
                  <input
                    className="rounded border border-[var(--era-border)] px-2 py-1.5"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("newName")}</span>
                  <input
                    className="rounded border border-[var(--era-border)] px-2 py-1.5"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("cloneFrom")}
                  value={cloneFrom}
                  onChange={(v) => setCloneFrom(String(v))}
                  options={roleOptions}
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
                  <h3 className="mb-2 text-sm font-semibold">{t(group.labelKey as "title")}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.has(p)}
                          onChange={() => togglePermission(p)}
                        />
                        <span>{permLabel(p)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={CARD_CONTAINER_CLASS}>
        <h3 className="mb-3 text-sm font-semibold">{t("assignTitle")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <CatalogField
              kind="SEARCHABLE"
              label={t("assignUser")}
              value={assignUserId}
              onChange={(v) => setAssignUserId(String(v))}
              options={userOptions}
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("assignRole")}
              value={assignRoleCode}
              onChange={(v) => setAssignRoleCode(String(v))}
              options={roleOptions}
            />
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !assignUserId || !assignRoleCode}
            onClick={() => void assignRole()}
          >
            {t("assign")}
          </button>
        </div>
      </div>
    </main>
  );
}
