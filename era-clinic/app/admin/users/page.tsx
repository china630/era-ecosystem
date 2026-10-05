"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PageHeader,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type RoleRow = { code: string; name: string; isSystem?: boolean };
type UserRow = {
  id: string;
  login: string;
  fullName: string;
  status: string;
  isCrossSystem: boolean;
  roleCode: string;
};

export default function ClinicAdminUsersPage() {
  const t = useTranslations("adminAccess");
  const tc = useTranslations("common");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.code, label: `${r.name} (${r.code})` })),
    [roles],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, usersRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/admin/users"),
      ]);
      if (!rolesRes.ok) {
        showApiError(await rolesRes.json().catch(() => ({})), tc("loadError"));
        return;
      }
      if (!usersRes.ok) {
        showApiError(await usersRes.json().catch(() => ({})), tc("loadError"));
        return;
      }
      setRoles((await rolesRes.json()) as RoleRow[]);
      setUsers((await usersRes.json()) as UserRow[]);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignUserRole(userId: string, roleCode: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleCode }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("assignError"));
        return;
      }
      showSuccess(t("assigned"));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("assignError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("usersTitle")} subtitle={t("usersSubtitle")} />
      <div className={CARD_CONTAINER_CLASS + " p-4"}>
        {loading ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("usersEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <div className="min-w-[12rem] flex-1">
                  <div className="font-medium">{u.fullName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {u.login}
                    {u.status !== "ACTIVE" ? ` · ${u.status}` : ""}
                    {u.isCrossSystem ? ` · ${t("crossSystemBadge")}` : ""}
                  </div>
                </div>
                <div className="min-w-[12rem] w-56">
                  <CatalogField
                    kind={roles.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
                    label={t("assignRole")}
                    value={u.roleCode}
                    onChange={(v) => {
                      const next = String(v ?? "");
                      if (next && next !== u.roleCode) void assignUserRole(u.id, next);
                    }}
                    options={roleOptions}
                    emptyLabel={null}
                    disabled={busy || roles.length === 0}
                    widthPreset="select"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
