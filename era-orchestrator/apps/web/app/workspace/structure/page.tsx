"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { satelliteUrlForItem } from "@era/satellite-kit/platform/industry-modules";
import {
  WORKSPACE_SATELLITE_KEY,
  WORKSPACE_SYSTEMS,
  type WorkspaceSystemKey,
} from "@era/satellite-kit/platform/workspace-system-catalog";
import { buildSatelliteSsoLaunchUrlFromTicket } from "@era/satellite-kit/auth/sso-launch";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  Field,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { orchFetch } from "../../../lib/orch-api";
import {
  buildFinanceHandoffUrl,
  ensureFreshOrchAccessToken,
  fetchSatelliteLaunchUrl,
  fetchSatelliteSsoTicket,
  getOrchAccessToken,
} from "../../../lib/open-finance";
import {
  industryNavItemForKey,
  workspaceOpenHref,
} from "../../../lib/workspace-access";

type OutletRow = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  effectiveSuspended?: boolean;
};

type SatNode = {
  satelliteKey: string;
  name?: string | null;
  suspended: boolean;
  suspendedAt?: string | null;
  effectiveSuspended?: boolean;
  inheritedOffReason?: string | null;
  outlets: OutletRow[];
};

type OrgNode = {
  organizationId: string;
  name: string;
  operatingMode?: string;
  parentOrgId?: string | null;
  isBlocked?: boolean;
  effectiveBlocked?: boolean;
  inheritedOffReason?: string | null;
  satellites: SatNode[];
};

type TreeResponse = {
  rootOrganizationId: string;
  activeOrganizationId: string;
  organization: OrgNode;
  departments: OrgNode[];
};

function systemKeyForSatellite(satelliteKey: string): WorkspaceSystemKey | null {
  const hit = (Object.entries(WORKSPACE_SATELLITE_KEY) as [WorkspaceSystemKey, string][]).find(
    ([, key]) => key === satelliteKey,
  );
  return hit?.[0] ?? null;
}

export default function StructurePage() {
  const { ready } = useRequireAuth();
  const { token, user, switchOrganization } = useAuth();
  const t = useTranslations("structure");
  const tSystems = useTranslations("workspace.systems");

  function displaySatName(sat: SatNode): string {
    if (sat.name?.trim()) return sat.name.trim();
    const sys = systemKeyForSatellite(sat.satelliteKey);
    const meta = WORKSPACE_SYSTEMS.find((s) => s.key === sys);
    if (meta?.i18nKey) {
      try {
        return tSystems(`${meta.i18nKey}.title` as "finance.title");
      } catch {
        return sat.satelliteKey;
      }
    }
    return sat.satelliteKey;
  }

  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOutlet, setEditOutlet] = useState<OutletRow | null>(null);
  const [outletForm, setOutletForm] = useState({
    satelliteKey: "",
    code: "",
    name: "",
  });
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Prefer storage token: after switchOrganization, React `token` may still be stale
    // until re-render while setOrchTokens already wrote the new JWT.
    const access = getOrchAccessToken() ?? token;
    if (!access) return;
    setLoading(true);
    try {
      const res = await orchFetch("/v1/structure/tree", { token: access });
      if (!res.ok) {
        toast.error(t("loadFailed"));
        return;
      }
      setTree((await res.json()) as TreeResponse);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (ready && (token || getOrchAccessToken())) void load();
  }, [ready, token, load]);

  const activeOrg: OrgNode | null = useMemo(() => {
    if (!tree?.organization) return null;
    if (tree.activeOrganizationId === tree.rootOrganizationId) {
      return tree.organization;
    }
    return (
      (tree.departments ?? []).find((d) => d.organizationId === tree.activeOrganizationId) ??
      tree.organization
    );
  }, [tree]);

  const viewingDepartment =
    Boolean(tree) &&
    tree!.activeOrganizationId !== tree!.rootOrganizationId &&
    activeOrg != null;

  const satOptions = useMemo(
    () =>
      (activeOrg?.satellites ?? []).map((s) => ({
        value: s.satelliteKey,
        label: s.name?.trim() || displaySatName(s),
        disabled: Boolean(s.effectiveSuspended || s.suspended),
      })),
    // displaySatName reads tSystems; rebuild when locale or active org satellites change
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sat labels from activeOrg
    [activeOrg, tSystems],
  );

  useEffect(() => {
    setOutletForm((f) => {
      const stillValid = satOptions.some((o) => o.value === f.satelliteKey && !o.disabled);
      if (stillValid) return f;
      const first = satOptions.find((o) => !o.disabled) ?? satOptions[0];
      return { ...f, satelliteKey: first?.value ?? "" };
    });
  }, [activeOrg?.organizationId, satOptions]);

  async function onSwitchOrg(organizationId: string) {
    if (!organizationId || switching) return;
    if (tree && organizationId === tree.activeOrganizationId) return;
    setSwitching(true);
    try {
      await switchOrganization(organizationId);
      await load();
    } catch {
      toast.error(t("switchFailed"));
    } finally {
      setSwitching(false);
    }
  }

  async function setSatSuspend(satelliteKey: string, suspend: boolean) {
    const access = getOrchAccessToken() ?? token;
    if (!access) return;
    const ok = window.confirm(suspend ? t("confirmSuspendSat") : t("confirmResumeSat"));
    if (!ok) return;
    setBusy(true);
    try {
      const res = await orchFetch(
        `/v1/structure/satellites/${encodeURIComponent(satelliteKey)}/suspend`,
        {
          token: access,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suspend }),
        },
      );
      if (!res.ok) {
        toast.error(t("suspendFailed"));
        return;
      }
      toast.success(suspend ? t("satSuspended") : t("satResumed"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setOutletStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    const access = getOrchAccessToken() ?? token;
    if (!access) return;
    setBusy(true);
    try {
      const res = await orchFetch(`/v1/structure/outlets/${encodeURIComponent(id)}`, {
        token: access,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(t("outletFailed"));
        return;
      }
      toast.success(status === "SUSPENDED" ? t("outletSuspended") : t("outletResumed"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveOutletName() {
    const access = getOrchAccessToken() ?? token;
    if (!access || !editOutlet) return;
    const name = editName.trim();
    if (!name) {
      toast.error(t("nameRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await orchFetch(
        `/v1/structure/outlets/${encodeURIComponent(editOutlet.id)}`,
        {
          token: access,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) {
        toast.error(t("outletFailed"));
        return;
      }
      toast.success(t("outletUpdated"));
      setEditOutlet(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteOutlet(id: string) {
    const access = getOrchAccessToken() ?? token;
    if (!access) return;
    if (!window.confirm(t("confirmDeleteOutlet"))) return;
    setBusy(true);
    try {
      const res = await orchFetch(`/v1/structure/outlets/${encodeURIComponent(id)}`, {
        token: access,
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t("outletFailed"));
        return;
      }
      toast.success(t("outletDeleted"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createOutlet() {
    const access = getOrchAccessToken() ?? token;
    if (!access) return;
    const satelliteKey = outletForm.satelliteKey.trim();
    const code = outletForm.code.trim().toUpperCase();
    const name = outletForm.name.trim();
    if (!satelliteKey || !code || !name) {
      toast.error(t("formRequired"));
      return;
    }
    const selected = satOptions.find((o) => o.value === satelliteKey);
    if (!selected || selected.disabled) {
      toast.error(t("satSuspendedPickOther"));
      return;
    }
    setBusy(true);
    try {
      const res = await orchFetch("/v1/structure/outlets", {
        token: access,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ satelliteKey, code, name }),
      });
      if (!res.ok) {
        toast.error(t("outletFailed"));
        return;
      }
      setOutletForm((f) => ({ ...f, code: "", name: "" }));
      setAddOpen(false);
      toast.success(t("outletCreatedBilling"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openSatellite(satelliteKey: string) {
    if (!user?.email || !user.organizationId) return;
    const sys = systemKeyForSatellite(satelliteKey);
    const popup = window.open("", "_blank");

    if (sys === "FINANCE" || satelliteKey === "finance_core") {
      void buildFinanceHandoffUrl().then((result) => {
        if (!result.ok) {
          popup?.close();
          if (result.reason === "needs_relogin") {
            window.location.assign("/login?reason=session_expired");
            return;
          }
          toast.error(t("openFailed"));
          return;
        }
        if (popup) popup.location.href = result.url;
        else window.open(result.url, "_blank", "noopener,noreferrer");
      });
      return;
    }

    const organizationId = user.organizationId;
    void (async () => {
      const access = await ensureFreshOrchAccessToken();
      if (!access) {
        popup?.close();
        window.location.assign("/login?reason=session_expired");
        return;
      }
      const fromRegistry = await fetchSatelliteLaunchUrl(access, satelliteKey);
      const item = sys ? industryNavItemForKey(sys) : null;
      const base =
        fromRegistry?.baseUrl ?? (item ? satelliteUrlForItem(item) : null);
      if (!base) {
        popup?.close();
        const href = sys ? workspaceOpenHref(sys) : null;
        if (href) window.open(href, "_blank");
        else toast.error(t("openFailed"));
        return;
      }
      const ticket = await fetchSatelliteSsoTicket(access, organizationId);
      if (!ticket) {
        popup?.close();
        toast.error(t("openFailed"));
        return;
      }
      const url = buildSatelliteSsoLaunchUrlFromTicket(base, ticket);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    })();
  }

  function satStatusLabel(sat: SatNode, parentBlocked: boolean): string {
    if (parentBlocked || sat.inheritedOffReason === "organization_blocked") {
      return t("inheritedOff");
    }
    if (sat.suspended || sat.effectiveSuspended) return t("suspended");
    return t("statusActive");
  }

  if (!ready || !user) return null;

  const root = tree?.organization;
  const parentBlocked = Boolean(activeOrg?.isBlocked || activeOrg?.effectiveBlocked);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <p className="text-sm text-[#5D6D7E]">{t("deptHelp")}</p>

      {viewingDepartment && activeOrg ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-[#6C3483]">
          <span>{t("viewingDepartment", { name: activeOrg.name })}</span>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={switching}
            onClick={() => void onSwitchOrg(tree!.rootOrganizationId)}
          >
            {t("backToRoot")}
          </button>
        </div>
      ) : null}

      {loading && !tree ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      {root ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#2980B9]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1A5276]">
              {t("badgeOrg")}
            </span>
            <span className="text-lg font-semibold text-[#2C3E50]">{root.name}</span>
            {root.operatingMode ? (
              <span className="rounded bg-[#EBEDF0] px-1.5 py-0.5 text-[11px] text-[#475569]">
                {root.operatingMode}
              </span>
            ) : null}
            {root.isBlocked || root.effectiveBlocked ? (
              <span className="text-sm text-red-600">{t("orgBlocked")}</span>
            ) : null}
            {tree && tree.activeOrganizationId !== tree.rootOrganizationId ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={switching}
                onClick={() => void onSwitchOrg(tree.rootOrganizationId)}
              >
                {t("switchHere")}
              </button>
            ) : (
              <span className="text-[12px] text-emerald-700">{t("currentContext")}</span>
            )}
          </div>

          {(tree?.departments ?? []).length > 0 ? (
            <div className="space-y-2 border-t border-[#EBEDF0] pt-3">
              <h2 className="text-sm font-semibold text-[#34495E]">{t("departmentsSection")}</h2>
              <ul className="space-y-2">
                {(tree?.departments ?? []).map((d) => {
                  const isActive = tree?.activeOrganizationId === d.organizationId;
                  return (
                    <li
                      key={d.organizationId}
                      className="flex flex-wrap items-center gap-2 rounded border border-[#EBEDF0] px-3 py-2"
                    >
                      <span className="rounded bg-[#8E44AD]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#6C3483]">
                        {t("badgeDept")}
                      </span>
                      <span className="font-medium text-[#2C3E50]">{d.name}</span>
                      {d.operatingMode ? (
                        <span className="text-[11px] text-[#7F8C8D]">{d.operatingMode}</span>
                      ) : null}
                      {d.isBlocked || d.effectiveBlocked ? (
                        <span className="text-[12px] text-red-600">{t("orgBlocked")}</span>
                      ) : null}
                      {isActive ? (
                        <span className="text-[12px] text-emerald-700">{t("currentContext")}</span>
                      ) : (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={switching}
                          onClick={() => void onSwitchOrg(d.organizationId)}
                        >
                          {t("switchHere")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#34495E]">
            {t("systemsSection", { name: activeOrg?.name ?? "—" })}
          </h2>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!satOptions.some((o) => !o.disabled) || busy}
            onClick={() => setAddOpen(true)}
          >
            {t("addOutlet")}
          </button>
        </div>

        {!activeOrg?.satellites?.length ? (
          <div className="space-y-2 text-sm text-[#5D6D7E]">
            <p>{t("noSatellites")}</p>
            <Link href="/workspace" className={SECONDARY_BUTTON_CLASS}>
              {t("goSystems")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {(activeOrg?.satellites ?? []).map((s) => {
              const effectiveOff =
                parentBlocked || Boolean(s.suspended) || Boolean(s.effectiveSuspended);
              const resumeBlocked =
                parentBlocked || s.inheritedOffReason === "organization_blocked";
              const label = s.name?.trim() || displaySatName(s);
              return (
                <li
                  key={s.satelliteKey}
                  className="space-y-3 rounded-lg border border-[#EBEDF0] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#34495E]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#34495E]">
                      {t("badgeSat")}
                    </span>
                    <span className="font-medium text-[#2C3E50]">{label}</span>
                    <span className="text-[11px] text-[#7F8C8D]">{s.satelliteKey}</span>
                    <span
                      className={`text-[12px] ${
                        effectiveOff ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {satStatusLabel(s, parentBlocked)}
                    </span>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={busy || (s.suspended ? resumeBlocked : parentBlocked)}
                      onClick={() => void setSatSuspend(s.satelliteKey, !s.suspended)}
                    >
                      {s.suspended ? t("resume") : t("suspend")}
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => openSatellite(s.satelliteKey)}
                    >
                      {t("openInSatellite", { name: label })}
                    </button>
                  </div>

                  {(s.outlets ?? []).length === 0 ? (
                    <p className="text-sm text-[#7F8C8D]">{t("noOutlets")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[28rem] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#EBEDF0] text-[11px] uppercase text-[#7F8C8D]">
                            <th className="py-1.5 pr-2 font-semibold">{t("colCode")}</th>
                            <th className="py-1.5 pr-2 font-semibold">{t("colName")}</th>
                            <th className="py-1.5 pr-2 font-semibold">{t("colStatus")}</th>
                            <th className="py-1.5 font-semibold">{t("colActions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(s.outlets ?? []).map((o) => (
                            <tr key={o.id} className="border-b border-[#F4F6F7]">
                              <td className="py-2 pr-2 font-mono text-[12px]">{o.code}</td>
                              <td className="py-2 pr-2">{o.name}</td>
                              <td className="py-2 pr-2">
                                <span
                                  className={
                                    o.status === "SUSPENDED" || o.effectiveSuspended
                                      ? "text-amber-700"
                                      : "text-emerald-700"
                                  }
                                >
                                  {o.status === "SUSPENDED" || o.effectiveSuspended
                                    ? t("suspended")
                                    : t("statusActive")}
                                </span>
                              </td>
                              <td className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    disabled={busy}
                                    onClick={() => {
                                      setEditOutlet(o);
                                      setEditName(o.name);
                                    }}
                                  >
                                    {t("edit")}
                                  </button>
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    disabled={busy || Boolean(effectiveOff)}
                                    onClick={() =>
                                      void setOutletStatus(
                                        o.id,
                                        o.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                                      )
                                    }
                                  >
                                    {o.status === "ACTIVE" ? t("suspend") : t("resume")}
                                  </button>
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    disabled={busy}
                                    onClick={() => void deleteOutlet(o.id)}
                                  >
                                    {t("delete")}
                                  </button>
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    onClick={() => openSatellite(s.satelliteKey)}
                                  >
                                    {t("openSatelliteShort")}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ModalShell
        open={addOpen}
        title={t("addOutlet")}
        subtitle={t("addOutletHint")}
        onClose={() => setAddOpen(false)}
        closeLabel={t("close")}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-3 p-1">
          <CatalogField
            kind={satOptions.length > 12 ? "CLOSED_MEDIUM" : "CLOSED_SMALL"}
            label={t("fieldSatellite")}
            value={outletForm.satelliteKey}
            onChange={(v) =>
              setOutletForm((f) => ({ ...f, satelliteKey: String(v) }))
            }
            options={satOptions}
            required
            emptyLabel={null}
          />
          <Field
            preset="code"
            label={t("fieldCode")}
            value={outletForm.code}
            onChange={(e) =>
              setOutletForm((f) => ({ ...f, code: e.target.value }))
            }
            hint={t("codeHint")}
            required
          />
          <Field
            preset="shortText"
            label={t("fieldName")}
            value={outletForm.name}
            onChange={(e) =>
              setOutletForm((f) => ({ ...f, name: e.target.value }))
            }
            required
          />
          <p className="text-xs text-[#7F8C8D]">{t("billingNote")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void createOutlet()}
            >
              {t("createOutlet")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setAddOpen(false)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={editOutlet != null}
        title={t("editOutlet")}
        onClose={() => setEditOutlet(null)}
        closeLabel={t("close")}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 p-1">
          {editOutlet ? (
            <p className="text-sm text-[#7F8C8D]">
              {t("editingCode", { code: editOutlet.code })}
            </p>
          ) : null}
          <Field
            preset="shortText"
            label={t("fieldName")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void saveOutletName()}
            >
              {t("save")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setEditOutlet(null)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
