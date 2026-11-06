"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import {
  resolveCutoverIndustries,
  showCutoverTab,
  type OperatingMode,
  type OrgHeaderMeta,
  type VendorBridgeBundle,
} from "@/lib/org-hub-shared";

type ShellCtx = {
  orgId: string;
  meta: OrgHeaderMeta;
  mode: OperatingMode | null;
  reloadHeader: () => Promise<void>;
  setFlash: (text: string) => void;
};

const OrgShellContext = createContext<ShellCtx | null>(null);

export function useOrgShell(): ShellCtx {
  const ctx = useContext(OrgShellContext);
  if (!ctx) throw new Error("useOrgShell requires OrgShell");
  return ctx;
}

export function OrgShell({ children }: { children: ReactNode }) {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const pathname = usePathname();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgShell");
  const [mode, setMode] = useState<OperatingMode | null>(null);
  const [meta, setMeta] = useState<OrgHeaderMeta>({
    name: "",
    publicOrgNumber: null,
    mode: null,
    topology: null,
    tier: null,
    billingStatus: null,
    industries: [],
  });
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);

  const reloadHeader = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [modeRes, treeRes, bridgeRes, epRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
        orchFetch(`/v1/admin/organizations/${orgId}/subscription-tree`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/elektraweb-bridge`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints`, { token }),
      ]);
      let nextMode: OperatingMode | null = null;
      if (modeRes.ok) {
        nextMode = (await modeRes.json()) as OperatingMode;
        setMode(nextMode);
      }
      let topology: string | null = null;
      let tier: string | null = null;
      let billingStatus: string | null = null;
      let name = nextMode?.name ?? "";
      if (treeRes.ok) {
        const tree = (await treeRes.json()) as {
          organizationName?: string;
          org?: {
            deploymentTopology?: string;
            currentTier?: string;
            billingStatus?: string;
          };
        };
        name = tree.organizationName ?? name;
        topology = tree.org?.deploymentTopology ?? null;
        tier = tree.org?.currentTier ?? null;
        billingStatus = tree.org?.billingStatus ?? null;
      }
      let bridgeIndustries: string[] = [];
      if (bridgeRes.ok) {
        const bundle = (await bridgeRes.json()) as VendorBridgeBundle;
        bridgeIndustries = bundle.industries ?? [];
      }
      let endpoints: Array<{ satelliteKey: string; enabled: boolean }> = [];
      if (epRes.ok) {
        endpoints = (await epRes.json()) as Array<{
          satelliteKey: string;
          enabled: boolean;
        }>;
      }
      const industries = resolveCutoverIndustries({
        bridgeIndustries,
        endpoints,
        operatingMode: nextMode?.mode,
      });
      setMeta({
        name,
        publicOrgNumber: nextMode?.publicOrgNumber ?? null,
        mode: nextMode?.mode ?? null,
        topology,
        tier,
        billingStatus,
        industries,
      });
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reloadHeader();
  }, [reloadHeader]);

  const copyUuid = () => {
    void navigator.clipboard.writeText(orgId);
    setFlash(t("copiedUuid"));
  };

  const copyOrgNo = () => {
    if (meta.publicOrgNumber == null) return;
    void navigator.clipboard.writeText(String(meta.publicOrgNumber));
    setFlash(t("copiedOrgNo", { orgNo: meta.publicOrgNumber }));
  };

  const cutoverVisible = showCutoverTab(meta.industries);

  const tabs = useMemo(() => {
    const base = [
      { href: `/orgs/${orgId}`, label: t("tabOverview"), match: "exact" as const },
      { href: `/orgs/${orgId}/subscription`, label: t("tabLicense"), match: "prefix" as const },
      { href: `/orgs/${orgId}/connections`, label: t("tabConnections"), match: "prefix" as const },
    ];
    if (cutoverVisible) {
      base.push({
        href: `/orgs/${orgId}/cutover`,
        label: t("tabCutover"),
        match: "prefix",
      });
    }
    base.push({
      href: `/orgs/${orgId}/placement`,
      label: t("tabPlacement"),
      match: "prefix",
    });
    return base;
  }, [orgId, t, cutoverVisible]);

  const ctxValue = useMemo(
    () => ({ orgId, meta, mode, reloadHeader, setFlash }),
    [orgId, meta, mode, reloadHeader],
  );

  return (
    <OrgShellContext.Provider value={ctxValue}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/orgs" className={GHOST_BUTTON_CLASS}>
            {t("backOrgs")}
          </Link>
          <h1 className="text-lg font-semibold text-[#34495E]">
            {meta.name || (loading ? t("loading") : t("untitled"))}
          </h1>
          {meta.publicOrgNumber != null ? (
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} font-mono text-sm`}
              onClick={copyOrgNo}
              title={t("copyOrgNoHint")}
            >
              {t("eraIdLabel")}: {meta.publicOrgNumber}
            </button>
          ) : null}
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={copyUuid}>
            {t("copyUuid")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-[#7F8C8D]">
          {meta.mode ? (
            <span className="rounded-full bg-[#ECF0F1] px-2 py-0.5 font-medium text-[#34495E]">
              {meta.mode}
            </span>
          ) : null}
          {meta.topology ? (
            <span className="rounded-full bg-[#ECF0F1] px-2 py-0.5 font-medium text-[#34495E]">
              {meta.topology}
            </span>
          ) : null}
          {meta.tier ? (
            <span className="rounded-full bg-[#ECF0F1] px-2 py-0.5 font-medium text-[#34495E]">
              {meta.tier}
            </span>
          ) : null}
          {meta.billingStatus ? (
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                meta.billingStatus === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-800"
                  : meta.billingStatus === "SOFT_BLOCK"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-red-50 text-red-800"
              }`}
            >
              {meta.billingStatus}
            </span>
          ) : null}
        </div>

        <nav className={TAB_STRIP_CLASS} aria-label={t("tabsAria")}>
          {tabs.map((tab) => {
            const active =
              tab.match === "exact"
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={active ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {flash ? <p className="text-sm text-emerald-700">{flash}</p> : null}

        {children}
      </div>
    </OrgShellContext.Provider>
  );
}
