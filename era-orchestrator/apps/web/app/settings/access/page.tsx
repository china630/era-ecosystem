"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

type RoleRow = {
  code: string;
  name: string;
  isSystem: boolean;
  cloneFromCode: string | null;
  permissionCount: number;
  permissions: string[];
  userCount: number;
  customized: boolean;
};

type CatalogGroup = {
  id: string;
  labelKey: string;
  permissions: string[];
};

export default function AccessSettingsPage() {
  const { ready } = useRequireAuth();
  const { token, can, applyAccessToken } = useAuth();
  const t = useTranslations("settings");
  const tAccess = useTranslations("settings.access");
  const tCommon = useTranslations("common");

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [auditorAllowlist, setAuditorAllowlist] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloneCode, setCloneCode] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneFrom, setCloneFrom] = useState("ADMIN");

  const canManage = can("admin:access_manage");

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const [rolesRes, catalogRes] = await Promise.all([
      orchFetch("/platform/v1/access/roles", { token }),
      orchFetch("/platform/v1/access/catalog", { token }),
    ]);
    if (!rolesRes.ok || !catalogRes.ok) {
      setError(tAccess("loadError"));
      return;
    }
    const roleRows = (await rolesRes.json()) as RoleRow[];
    const catalog = (await catalogRes.json()) as {
      groups: CatalogGroup[];
      locked: string[];
      auditorAllowlist?: string[];
    };
    setRoles(roleRows);
    setGroups(catalog.groups ?? []);
    setLocked(catalog.locked ?? []);
    setAuditorAllowlist(catalog.auditorAllowlist ?? []);
    if (!selectedCode && roleRows[0]) {
      setSelectedCode(roleRows[0].code);
      setDraft(new Set(roleRows[0].permissions));
    }
  }, [token, tAccess, selectedCode]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  const selected = useMemo(
    () => roles.find((r) => r.code === selectedCode) ?? null,
    [roles, selectedCode],
  );

  function selectRole(code: string) {
    const row = roles.find((r) => r.code === code);
    setSelectedCode(code);
    setDraft(new Set(row?.permissions ?? []));
  }

  async function refreshSession() {
    if (!token) return;
    const res = await orchFetch("/platform/v1/access/session/refresh-permissions", {
      method: "POST",
      token,
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (data.accessToken) {
      applyAccessToken(data.accessToken, data.refreshToken);
    }
  }

  async function save() {
    if (!token || !selectedCode || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch(
        `/platform/v1/access/roles/${encodeURIComponent(selectedCode)}/permissions`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ permissions: [...draft] }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? tAccess("saveError"));
        return;
      }
      await refreshSession();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    if (!token || !selectedCode || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch(
        `/platform/v1/access/roles/${encodeURIComponent(selectedCode)}/permissions`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ resetToDefaults: true }),
        },
      );
      if (!res.ok) {
        setError(tAccess("saveError"));
        return;
      }
      const row = (await res.json()) as { permissions: string[] };
      setDraft(new Set(row.permissions));
      await refreshSession();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cloneRole() {
    if (!token || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/platform/v1/access/roles", {
        method: "POST",
        token,
        body: JSON.stringify({
          code: cloneCode.trim().toUpperCase(),
          name: cloneName.trim() || cloneCode.trim().toUpperCase(),
          cloneFrom,
        }),
      });
      if (!res.ok) {
        setError(tAccess("cloneError"));
        return;
      }
      setCloneCode("");
      setCloneName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tAccess("title")}
        description={tAccess("subtitle")}
        icon={Shield}
      />
      {error ? (
        <p className="text-sm text-[var(--era-danger,#b91c1c)]">{error}</p>
      ) : null}
      <p className="text-sm text-[var(--era-muted)]">{tAccess("financeWave5Hint")}</p>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-3`}>
          {roles.map((role) => (
            <button
              key={role.code}
              type="button"
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                selectedCode === role.code
                  ? "bg-[var(--era-accent-soft,#e8f0fe)] font-medium"
                  : "hover:bg-[var(--era-surface-2,#f5f5f5)]"
              }`}
              onClick={() => selectRole(role.code)}
            >
              <div>{role.name}</div>
              <div className="text-xs text-[var(--era-muted)]">
                {role.code}
                {role.customized ? ` · ${tAccess("customized")}` : ""}
                {` · ${role.permissionCount}`}
              </div>
            </button>
          ))}
        </div>

        <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                {selected.isSystem ? (
                  <span className="text-xs text-[var(--era-muted)]">
                    {tAccess("systemRole")}
                  </span>
                ) : null}
              </div>
              {groups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <h3 className="text-sm font-medium">
                    {tAccess(`groups.${group.labelKey}` as "groups.groupOrg")}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((perm) => {
                      const isLocked = locked.includes(perm);
                      const auditorBlocked =
                        (selected.code === "AUDITOR" ||
                          selected.cloneFromCode === "AUDITOR") &&
                        auditorAllowlist.length > 0 &&
                        !auditorAllowlist.includes(perm);
                      const blocked = isLocked || auditorBlocked;
                      const checked = draft.has(perm);
                      const labelKey = `permissions.${perm.replace(/[:.]/g, "_")}`;
                      return (
                        <label
                          key={perm}
                          className={`flex items-start gap-2 text-sm ${
                            blocked || !canManage ? "opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={blocked || !canManage || busy}
                            onChange={(e) => {
                              setDraft((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(perm);
                                else next.delete(perm);
                                return next;
                              });
                            }}
                          />
                          <span>
                            <span className="font-mono text-xs">{perm}</span>
                            <span className="mt-0.5 block text-[var(--era-muted)]">
                              {tAccess(labelKey as "permissions.api_org_members_read")}
                              {isLocked || auditorBlocked
                                ? ` (${tAccess("locked")})`
                                : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {canManage ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    {tCommon("save")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void resetDefaults()}
                  >
                    {tAccess("resetDefaults")}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[var(--era-muted)]">
                  {tAccess("readOnly")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--era-muted)]">{tAccess("pickRole")}</p>
          )}
        </div>
      </div>

      {canManage ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-base font-semibold">{tAccess("cloneTitle")}</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder={tAccess("cloneCode")}
              value={cloneCode}
              onChange={(e) => setCloneCode(e.target.value)}
            />
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder={tAccess("cloneName")}
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1 text-sm"
              value={cloneFrom}
              onChange={(e) => setCloneFrom(e.target.value)}
            >
              {roles
                .filter((r) => r.isSystem)
                .map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || !cloneCode.trim()}
              onClick={() => void cloneRole()}
            >
              {tAccess("cloneAction")}
            </button>
          </div>
          <p className="text-xs text-[var(--era-muted)]">{t("title")}</p>
        </div>
      ) : null}
    </div>
  );
}
