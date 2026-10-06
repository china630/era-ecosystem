"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Role = { code: string; name: string };
type UserRow = {
  id: string;
  login: string;
  fullName: string;
  role: string;
  roleCode: string;
  status: string;
  isCrossSystem?: boolean;
  cpEmploymentId?: string | null;
  positionTitle?: string | null;
};

export default function RetailUsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [login, setLogin] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [busy, setBusy] = useState(false);

  const editingUser = users.find((u) => u.id === editId);
  const workforceLocked = Boolean(editingUser?.cpEmploymentId);

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/roles"),
    ]);
    if (!uRes.ok) showApiError(await uRes.json().catch(() => ({})), tc("loadError"));
    else setUsers(await uRes.json());
    if (rRes.ok) {
      const rows = (await rRes.json()) as Array<{ code: string; name: string }>;
      setRoles(rows);
      setRoleCode((prev) => prev || rows[0]?.code || "");
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditId(null);
    setLogin("");
    setFullName("");
    setPassword("");
    setStatus("ACTIVE");
    setRoleCode(roles[0]?.code ?? "");
    setOpen(true);
  }

  function openEdit(row: UserRow) {
    setEditId(row.id);
    setLogin(row.login);
    setFullName(row.fullName);
    setPassword("");
    setRoleCode(row.roleCode);
    setStatus(row.status);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const res = editId
        ? await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: editId,
              roleCode,
              status,
              ...(workforceLocked ? {} : { fullName }),
            }),
          })
        : await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login, fullName, password, roleCode }),
          });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("loadError"));
        return;
      }
      showSuccess(t("saved"));
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("add")}
          </button>
        }
      />
      <div className={CARD_CONTAINER_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLogin")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRole")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{row.login}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {row.fullName}
                  {row.positionTitle ? (
                    <span className="ml-2 text-xs text-[#7F8C8D]">{row.positionTitle}</span>
                  ) : null}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{row.role}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => openEdit(row)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className={`${CARD_CONTAINER_CLASS} grid max-w-lg gap-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{editId ? t("edit") : t("add")}</h2>
          {!editId ? (
            <label className="text-[13px] font-medium text-[#34495E]">
              {t("colLogin")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>
          ) : null}
          <label className="text-[13px] font-medium text-[#34495E]">
            {t("colName")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 disabled:bg-[#F4F6F7]"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              readOnly={workforceLocked}
            />
            {workforceLocked ? (
              <span className="mt-1 block text-xs text-[#7F8C8D]">{t("workforceNameLocked")}</span>
            ) : null}
          </label>
          {!editId ? (
            <label className="text-[13px] font-medium text-[#34495E]">
              {t("password")}
              <input
                type="password"
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : null}
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colRole")}
            value={roleCode}
            onChange={(next) => setRoleCode(String(next))}
            options={roles.map((r) => ({ value: r.code, label: r.name || r.code }))}
          />
          {editId ? (
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("colStatus")}
              value={status}
              onChange={(next) => setStatus(String(next))}
              options={[
                { value: "ACTIVE", label: t("statusActive") },
                { value: "DISABLED", label: t("statusDisabled") },
              ]}
            />
          ) : null}
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void save()}>
              {tc("save")}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setOpen(false)}>
              {tc("cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
