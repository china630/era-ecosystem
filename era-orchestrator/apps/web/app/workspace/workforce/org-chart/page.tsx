"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type ChartMode = "units" | "positions" | "people";

type ChartNode = {
  id: string;
  parentId: string | null;
  label: string;
  meta?: Record<string, unknown>;
};

function buildChildren(nodes: ChartNode[]) {
  const byParent = new Map<string | null, ChartNode[]>();
  for (const n of nodes) {
    const key = n.parentId;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }
  return byParent;
}

function ChartTree({
  nodes,
  parentId,
  depth,
  byParent,
}: {
  nodes: ChartNode[];
  parentId: string | null;
  depth: number;
  byParent: Map<string | null, ChartNode[]>;
}) {
  const kids = byParent.get(parentId) ?? [];
  if (kids.length === 0 && parentId === null) {
    return null;
  }
  return (
    <ul className={depth === 0 ? "space-y-1" : "ml-4 space-y-1 border-l border-[#D5DADF] pl-3"}>
      {kids.map((n) => (
        <li key={n.id}>
          <div
            className="rounded-lg px-2 py-1.5 text-[13px] text-[#2C3E50] hover:bg-[#F5F7FA]"
            style={{ marginLeft: depth === 0 ? 0 : undefined }}
          >
            {n.label}
          </div>
          <ChartTree
            nodes={nodes}
            parentId={n.id}
            depth={depth + 1}
            byParent={byParent}
          />
        </li>
      ))}
    </ul>
  );
}

export default function OrgChartPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceOrgChart");
  const [mode, setMode] = useState<ChartMode>("units");
  const [nodes, setNodes] = useState<ChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await wfFetch(`org-chart?mode=${encodeURIComponent(mode)}`);
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!res.ok) {
      setError(await res.text());
      setNodes([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { nodes?: ChartNode[] };
    let next = Array.isArray(body.nodes) ? body.nodes : [];
    if (mode === "people" && next.length > 0) {
      const empRes = await wfFetch("employments?status=ACTIVE&pageSize=100");
      if (empRes.ok) {
        const data = (await empRes.json()) as {
          items?: Array<{ id: string; globalPersonId?: string }>;
          persons?: Record<string, { displayName?: string | null }>;
        };
        const persons = data.persons ?? {};
        const byId = new Map((data.items ?? []).map((e) => [e.id, e]));
        next = next.map((n) => {
          const emp = byId.get(n.id);
          const name = emp?.globalPersonId
            ? persons[emp.globalPersonId]?.displayName?.trim()
            : null;
          return name ? { ...n, label: `${name} · ${n.label}` } : n;
        });
      }
    }
    setNodes(next);
    setLoading(false);
  }, [mode]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  const byParent = useMemo(() => buildChildren(nodes), [nodes]);
  const orphanRoots = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return nodes.filter((n) => n.parentId != null && !ids.has(n.parentId));
  }, [nodes]);

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate onEnabled={load} />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 max-w-xs">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("mode")}
          value={mode}
          onChange={(next) => {
            const v = String(next);
            setMode(
              v === "positions" || v === "people" ? v : "units",
            );
          }}
          options={[
            { value: "units", label: t("modeUnits") },
            { value: "positions", label: t("modePositions") },
            { value: "people", label: t("modePeople") },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-[#D5DADF] bg-white p-4">
        {loading ? (
          <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : nodes.length === 0 ? (
          <p className="text-sm text-[#7F8C8D]">{t("empty")}</p>
        ) : (
          <>
            <ChartTree
              nodes={nodes}
              parentId={null}
              depth={0}
              byParent={byParent}
            />
            {orphanRoots.length > 0 ? (
              <div className="mt-4 border-t border-[#EEF2F6] pt-3">
                <p className="mb-2 text-xs font-semibold text-[#7F8C8D]">
                  {t("orphans")}
                </p>
                <ul className="space-y-1">
                  {orphanRoots.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg px-2 py-1.5 text-[13px] text-[#2C3E50]"
                    >
                      {n.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
