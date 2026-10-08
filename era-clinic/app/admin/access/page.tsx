"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import {
  PERMISSION_GROUPS,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";

type RoleRow = {
  code: string;
  name: string;
  isSystem?: boolean;
  staffKind?: string;
  cloneFromCode?: string | null;
  userCount?: number;
  permissions: ClinicPermission[];
};

const STAFF_KIND_OPTIONS = [
  { value: "DOCTOR", label: "DOCTOR" },
  { value: "NURSE", label: "NURSE" },
  { value: "LAB", label: "LAB" },
  { value: "BATH", label: "BATH" },
  { value: "MASSAGE", label: "MASSAGE" },
  { value: "NONE", label: "NONE" },
];

export default function ClinicAdminAccessPage() {
  const t = useTranslations("adminAccess");
  const tc = useTranslations("common");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [draft, setDraft] = useState<Set<ClinicPermission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [cloneFrom, setCloneFrom] = useState("DOCTOR");
  const [createStaffKind, setCreateStaffKind] = useState("NONE");
  const [matrixOpen, setMatrixOpen] = useState(false);

  const selectedRole = roles.find((r) => r.code === selectedCode);

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
        const row = (await res.json()) as {
          permissions: ClinicPermission[];
          staffKind?: string;
        };
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
          staffKind: createStaffKind,
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

  async function deleteRole(role: RoleRow) {
    if (role.isSystem) return;
    if (
      !window.confirm(
        t("deleteConfirm", { code: role.code, name: role.name }),
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/roles/${encodeURIComponent(role.code)}`,
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
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || loading}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("createRole")}
          </button>
        }
      />

      <div className={CARD_CONTAINER_CLASS + " p-4 space-y-4"}>
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
                  placeholder="CHIEF_DOCTOR"
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
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("staffKindLabel")}
                value={createStaffKind}
                onChange={(v) => setCreateStaffKind(String(v ?? "NONE"))}
                options={STAFF_KIND_OPTIONS}
                emptyLabel={null}
                disabled={busy}
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

        {loading ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("roleLabel")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("roleUsers")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.code} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {role.name}
                      <span className="ml-2 text-[12px] text-[#7F8C8D]">{role.code}</span>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{role.userCount ?? 0}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <button
                        type="button"
                        className="inline-flex rounded p-1 text-[#2980B9] hover:bg-[#EBF5FB]"
                        aria-label={t("openMatrix")}
                        onClick={() => {
                          setSelectedCode(role.code);
                          setMatrixOpen(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4" aria-hidden />
                      </button>
                      {!role.isSystem ? (
                        <button
                          type="button"
                          className="ml-1 inline-flex rounded p-1 text-[#7F8C8D] hover:bg-[#FDEDEC] hover:text-[#C0392B] disabled:opacity-40"
                          aria-label={t("deleteRole")}
                          disabled={busy || (role.userCount ?? 0) > 0}
                          title={(role.userCount ?? 0) > 0 ? t("deleteBlockedUsers") : undefined}
                          onClick={() => void deleteRole(role)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalShell
        open={matrixOpen}
        title={selectedRole ? `${selectedRole.name} (${selectedRole.code})` : t("openMatrix")}
        onClose={() => setMatrixOpen(false)}
        maxWidthClass="max-w-5xl"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || loading || !selectedCode}
                onClick={() => void resetDefaults()}
              >
                {t("resetDefaults")}
              </button>
            </div>
            {grouped.map((group) => (
              <section key={group.id}>
                <h2 className="mb-2 text-sm font-semibold">{t(`groups.${group.id}`)}</h2>
                <div className="flex flex-wrap gap-2">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-start gap-2 rounded border border-[#D5DADF] px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
                        checked={draft.has(perm)}
                        onChange={() => togglePermission(perm)}
                        disabled={busy}
                      />
                      <span>
                        <span className="font-medium">
                          {(() => {
                            const key = `permissions.${perm.replace(/\./g, "_")}` as const;
                            return t.has(key) ? t(key) : perm;
                          })()}
                        </span>
                        <span className="block font-mono text-[11px] text-[#7F8C8D]">{perm}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
            <ModalFooter
              onCancel={() => setMatrixOpen(false)}
              onSubmit={() => void save()}
              busy={busy}
              submitDisabled={!selectedCode}
              submitLabel={tc("save")}
            />
          </div>
        )}
      </ModalShell>
    </div>
  );
}
