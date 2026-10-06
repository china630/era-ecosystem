"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from "@era/satellite-kit/ui";

type RoleRow = { code: string; name: string; isSystem?: boolean };
type UserRow = {
  id: string;
  login: string;
  fullName: string;
  status: string;
  isCrossSystem: boolean;
  roleCode: string;
  roleName?: string;
  positionTitle?: string | null;
};

export default function ClinicAdminUsersPage() {
  const t = useTranslations("adminAccess");
  const tc = useTranslations("common");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [roleCode, setRoleCode] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.code, label: r.name })),
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
      const rolesJson = await rolesRes.json();
      const usersJson = await usersRes.json();
      setRoles((rolesJson.data ?? rolesJson) as RoleRow[]);
      setUsers((usersJson.data ?? usersJson) as UserRow[]);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = debouncedQ.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.roleCode !== roleFilter) return false;
      if (statusFilter && user.status !== statusFilter) return false;
      if (!query) return true;
      return (
        user.login.toLowerCase().includes(query) ||
        user.fullName.toLowerCase().includes(query) ||
        (user.roleName ?? user.roleCode).toLowerCase().includes(query)
      );
    });
  }, [users, debouncedQ, roleFilter, statusFilter]);

  async function assignUserRole() {
    if (!editUser || !roleCode) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(editUser.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleCode }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), t("assignError"));
        return;
      }
      showSuccess(t("assigned"));
      setEditUser(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("assignError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("usersTitle")} subtitle={t("usersSubtitle")} />
      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setQ("");
          setRoleFilter("");
          setStatusFilter("");
        }}
      >
        <Field
          label={tc("search")}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t("assignRole")}
          value={roleFilter}
          onChange={(v) => setRoleFilter(String(v ?? ""))}
          options={roleOptions}
          emptyLabel={t("allRoles")}
          widthPreset="select"
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tc("status")}
          value={statusFilter}
          onChange={(v) => setStatusFilter(String(v ?? ""))}
          options={[
            { value: "ACTIVE", label: "ACTIVE" },
            { value: "DISABLED", label: "DISABLED" },
          ]}
          emptyLabel={t("allStatuses")}
          widthPreset="select"
        />
      </EraListFilterBar>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLogin")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("name")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("assignRole")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("status")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                  {tc("loading")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                  {t("usersEmpty")}
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{user.login}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{user.fullName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{user.positionTitle || "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{user.roleName || user.roleCode}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{user.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className="inline-flex rounded p-1 text-[#2980B9] hover:bg-[#EBF5FB]"
                      aria-label={tc("edit")}
                      onClick={() => {
                        setEditUser(user);
                        setRoleCode(user.roleCode);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ModalShell
        open={Boolean(editUser)}
        title={t("editRole")}
        subtitle={editUser?.fullName}
        onClose={() => {
          if (!busy) setEditUser(null);
        }}
      >
        <CatalogField
          kind={roles.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
          label={t("assignRole")}
          value={roleCode}
          onChange={(v) => setRoleCode(String(v ?? ""))}
          options={roleOptions}
          emptyLabel={null}
          disabled={busy}
          widthPreset="select"
        />
        <ModalFooter
          onCancel={() => setEditUser(null)}
          onSubmit={() => void assignUserRole()}
          busy={busy}
          submitDisabled={!roleCode}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </div>
  );
}
