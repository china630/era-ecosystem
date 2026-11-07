"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import { cpAdminFetch } from "@/lib/cp-admin-fetch";
import type { DepartmentRow, OperatingMode } from "@/lib/org-hub-shared";
import { useOrgShell } from "./org-shell";

type OrgSearchHit = {
  id: string;
  name: string;
  publicOrgNumber: number;
};

export default function SuperAdminOrgOverviewPage() {
  const { orgId, mode: shellMode, reloadHeader, setFlash } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [mode, setMode] = useState<OperatingMode | null>(shellMode);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [deptName, setDeptName] = useState("");
  const [parentQuery, setParentQuery] = useState("");
  const debouncedParentQ = useDebouncedValue(parentQuery, 300);
  const [parentHits, setParentHits] = useState<OrgSearchHit[]>([]);
  const [parentOrgId, setParentOrgId] = useState("");
  const [parentLabel, setParentLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [modeRes, deptRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/departments`, { token }),
      ]);
      if (modeRes.ok) {
        const next = (await modeRes.json()) as OperatingMode;
        setMode(next);
        if (next.parentOrgId) {
          setParentOrgId(next.parentOrgId);
          setParentLabel(next.parentOrgId);
          const parentRes = await cpAdminFetch(
            `organizations?${new URLSearchParams({
              q: next.parentOrgId,
              page: "1",
              pageSize: "5",
            })}`,
          );
          if (parentRes.ok) {
            const data = (await parentRes.json()) as { items?: OrgSearchHit[] };
            const hit = (data.items ?? []).find((h) => h.id === next.parentOrgId);
            if (hit) {
              setParentLabel(`${hit.name} · ${hit.publicOrgNumber}`);
            }
          }
        } else {
          setParentOrgId("");
          setParentLabel("");
        }
      }
      if (deptRes.ok) setDepartments((await deptRes.json()) as DepartmentRow[]);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setMode(shellMode);
  }, [shellMode]);

  useEffect(() => {
    const q = debouncedParentQ.trim();
    if (q.length < 2) {
      setParentHits([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await cpAdminFetch(
        `organizations?${new URLSearchParams({ q, page: "1", pageSize: "10" })}`,
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: OrgSearchHit[] };
      if (!cancelled) setParentHits(data.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedParentQ]);

  async function saveOperatingMode(nextMode: "STANDALONE" | "DEPARTMENT") {
    if (!token) return;
    setMessage("");
    const body =
      nextMode === "DEPARTMENT"
        ? {
            mode: "DEPARTMENT",
            parentOrgId: parentOrgId.trim() || mode?.parentOrgId,
            fiscalRouting: "PARENT",
            revenueRouting: "PARENT",
          }
        : { mode: "STANDALONE" };
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, {
      token,
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage(t("operatingModeSaveFailed", { status: res.status }));
      return;
    }
    setMode((await res.json()) as OperatingMode);
    setMessage(t("operatingModeSaved"));
    await reload();
    await reloadHeader();
  }

  async function createDepartment() {
    if (!token || !deptName.trim()) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/departments`, {
      token,
      method: "POST",
      body: JSON.stringify({ name: deptName.trim() }),
    });
    if (!res.ok) {
      setMessage(t("createDepartmentFailed", { status: res.status }));
      return;
    }
    setDeptName("");
    setMessage(t("departmentCreated"));
    await reload();
  }

  async function detachDepartment() {
    if (!token) return;
    if (!window.confirm(t("detachConfirm"))) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/operating-mode/detach`, {
      token,
      method: "POST",
    });
    if (!res.ok) {
      setMessage(t("detachFailed", { status: res.status }));
      return;
    }
    setMode((await res.json()) as OperatingMode);
    setParentOrgId("");
    setParentLabel("");
    setMessage(t("detached"));
    await reload();
    await reloadHeader();
  }

  function copyUuid(id: string) {
    void navigator.clipboard.writeText(id);
    setFlash(t("copied", { id }));
  }

  return (
    <div className="space-y-6">
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("operatingModeTitle")}</h2>
        {mode ? (
          <p className="text-sm text-[#7F8C8D]">
            {t("operatingModeCurrent", {
              mode: mode.mode,
              parent: mode.parentOrgId
                ? ` · parent ${parentLabel || mode.parentOrgId}`
                : "",
              fiscal: mode.fiscalRouting,
              revenue: mode.revenueRouting,
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void saveOperatingMode("STANDALONE")}
          >
            {t("setStandalone")}
          </button>
          {mode?.mode === "DEPARTMENT" ? (
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => void detachDepartment()}
            >
              {t("detach")}
            </button>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-[#ECF0F1] pt-3">
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("parentOrgLabel")}
          </label>
          {parentOrgId ? (
            <p className="text-sm text-[#34495E]">
              {parentLabel || parentOrgId}
              <button
                type="button"
                className="ml-2 text-xs text-[#2980B9]"
                onClick={() => {
                  setParentOrgId("");
                  setParentLabel("");
                  setParentQuery("");
                }}
              >
                {t("clearParent")}
              </button>
            </p>
          ) : (
            <>
              <input
                className={`${MODAL_INPUT_CLASS} max-w-md`}
                value={parentQuery}
                onChange={(e) => setParentQuery(e.target.value)}
                placeholder={t("parentOrgSearchPlaceholder")}
                aria-label={t("parentOrgLabel")}
              />
              {parentHits.length > 0 ? (
                <ul className="max-w-md divide-y divide-[#ECF0F1] rounded border border-[#ECF0F1] text-sm">
                  {parentHits
                    .filter((h) => h.id !== orgId)
                    .map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#F8FAFC]"
                          onClick={() => {
                            setParentOrgId(h.id);
                            setParentLabel(`${h.name} · ${h.publicOrgNumber}`);
                            setParentQuery("");
                            setParentHits([]);
                          }}
                        >
                          <span>{h.name}</span>
                          <span className="font-mono text-xs text-[#2980B9]">
                            {h.publicOrgNumber}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          )}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!parentOrgId}
            onClick={() => void saveOperatingMode("DEPARTMENT")}
          >
            {t("setDepartment")}
          </button>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">{t("departmentsTitle")}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("departmentNameLabel")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 min-w-[12rem]`}
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void createDepartment()}
          >
            {t("createDepartment")}
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <Link
                href={`/orgs/${d.id}`}
                className="font-medium text-[#2980B9] hover:underline"
              >
                {d.name}
              </Link>
              <code className="font-mono text-sm font-semibold text-[#2980B9]">
                {d.publicOrgNumber}
              </code>
              <button
                type="button"
                className="text-xs text-[#7F8C8D]"
                onClick={() => copyUuid(d.id)}
              >
                {t("copy")}
              </button>
            </li>
          ))}
          {departments.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("noDepartments")}</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
