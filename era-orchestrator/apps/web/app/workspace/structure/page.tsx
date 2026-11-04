"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  CARD_CONTAINER_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { orchFetch } from "../../../lib/orch-api";

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
  effectiveSuspended?: boolean;
  outlets: OutletRow[];
};

type OrgNode = {
  organizationId: string;
  name: string;
  operatingMode?: string;
  isBlocked?: boolean;
  effectiveBlocked?: boolean;
  satellites: SatNode[];
};

type TreeResponse = {
  organization: OrgNode;
  departments: OrgNode[];
};

export default function StructurePage() {
  const { ready } = useRequireAuth();
  const { token, user } = useAuth();
  const t = useTranslations("structure");
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [outletForm, setOutletForm] = useState({
    satelliteKey: "industry_fnb_pos",
    code: "",
    name: "",
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await orchFetch("/v1/structure/tree", { token });
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
    if (ready && token) void load();
  }, [ready, token, load]);

  async function setSatSuspend(satelliteKey: string, suspend: boolean) {
    if (!token) return;
    const res = await orchFetch(
      `/v1/structure/satellites/${encodeURIComponent(satelliteKey)}/suspend`,
      {
        token,
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
  }

  async function setOutletStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    if (!token) return;
    const res = await orchFetch(`/v1/structure/outlets/${encodeURIComponent(id)}`, {
      token,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error(t("outletFailed"));
      return;
    }
    await load();
  }

  async function createOutlet() {
    if (!token) return;
    const res = await orchFetch("/v1/structure/outlets", {
      token,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        satelliteKey: outletForm.satelliteKey,
        code: outletForm.code.trim().toUpperCase(),
        name: outletForm.name.trim(),
      }),
    });
    if (!res.ok) {
      toast.error(t("outletFailed"));
      return;
    }
    setOutletForm((f) => ({ ...f, code: "", name: "" }));
    toast.success(t("outletCreated"));
    await load();
  }

  function renderSats(sats: SatNode[], parentBlocked: boolean) {
    return (
      <ul className="ml-4 space-y-3 border-l border-[#EBEDF0] pl-4">
        {(sats ?? []).map((s) => {
          const effectiveOff = parentBlocked || s.suspended || s.effectiveSuspended;
          return (
            <li key={s.satelliteKey} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#34495E]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#34495E]">
                  SAT
                </span>
                <span className="font-medium text-[#2C3E50]">
                  {s.name ?? s.satelliteKey}
                </span>
                {effectiveOff ? (
                  <span className="text-[12px] text-amber-700">
                    {parentBlocked && !s.suspended ? t("offParent") : t("suspended")}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={parentBlocked}
                  onClick={() => void setSatSuspend(s.satelliteKey, !s.suspended)}
                >
                  {s.suspended ? t("resume") : t("suspend")}
                </button>
              </div>
              <ul className="ml-2 space-y-1">
                {(s.outlets ?? []).map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded bg-[#27AE60]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1E8449]">
                      OUTLET
                    </span>
                    <span>
                      {o.code} — {o.name}
                    </span>
                    <span className="text-[#7F8C8D]">{o.status}</span>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={Boolean(effectiveOff)}
                      onClick={() =>
                        void setOutletStatus(
                          o.id,
                          o.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                        )
                      }
                    >
                      {o.status === "ACTIVE" ? t("suspend") : t("resume")}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderOrg(node: OrgNode, depth: "root" | "dept") {
    const badge = depth === "dept" || node.operatingMode === "DEPARTMENT" ? "DEPT" : "ORG";
    const blocked = Boolean(node.isBlocked || node.effectiveBlocked);
    return (
      <div
        key={node.organizationId}
        className={depth === "dept" ? "mt-4 space-y-2 border-t border-[#EBEDF0] pt-4" : "space-y-2"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              badge === "DEPT"
                ? "bg-[#8E44AD]/15 text-[#6C3483]"
                : "bg-[#2980B9]/15 text-[#1A5276]"
            }`}
          >
            {badge}
          </span>
          <span className={depth === "root" ? "text-lg font-semibold text-[#2C3E50]" : "font-medium"}>
            {node.name}
          </span>
          {node.isBlocked ? (
            <span className="text-sm text-red-600">{t("orgBlocked")}</span>
          ) : null}
        </div>
        {renderSats(node.satellites ?? [], blocked)}
      </div>
    );
  }

  if (!ready || !user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {loading && !tree ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {tree?.organization ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
          {renderOrg(tree.organization, "root")}
          {(tree.departments ?? []).map((d) => renderOrg(d, "dept"))}
        </div>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("addOutlet")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-[#D5DADF] px-2 py-1.5 text-sm"
            placeholder="satelliteKey"
            value={outletForm.satelliteKey}
            onChange={(e) => setOutletForm((f) => ({ ...f, satelliteKey: e.target.value }))}
          />
          <input
            className="rounded border border-[#D5DADF] px-2 py-1.5 text-sm"
            placeholder="CODE"
            value={outletForm.code}
            onChange={(e) => setOutletForm((f) => ({ ...f, code: e.target.value }))}
          />
          <input
            className="rounded border border-[#D5DADF] px-2 py-1.5 text-sm"
            placeholder="Name"
            value={outletForm.name}
            onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createOutlet()}>
            {t("createOutlet")}
          </button>
        </div>
      </div>
    </div>
  );
}
