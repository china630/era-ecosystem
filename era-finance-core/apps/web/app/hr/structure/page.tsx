"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { parseHrEmployeesResponse } from "../../../lib/hr-employees-list";
import { CARD_CONTAINER_CLASS } from "../../../lib/design-system";

type TreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  children: TreeNode[];
};

function TreeSkeleton() {
  return (
    <div className="space-y-3 pl-2 border-l border-slate-100" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-9 rounded-lg bg-slate-100 animate-pulse"
          style={{ marginLeft: i * 12 }}
        />
      ))}
    </div>
  );
}

function TreeRows({
  nodes,
  depth,
  t,
}: {
  nodes: TreeNode[];
  depth: number;
  t: (k: string, o?: { defaultValue?: string }) => string;
}) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id} className="border-l border-slate-200 pl-3">
          <div
            className="flex flex-wrap items-center gap-2 py-2 rounded-lg bg-slate-50/80 px-2"
            style={{ marginLeft: depth * 12 }}
          >
            <span className="font-medium text-gray-900">{n.name}</span>
            <span className="text-xs text-slate-500">
              {t("hrStructure.manager")}:{" "}
              {n.manager
                ? `${n.manager.lastName} ${n.manager.firstName}`
                : t("hrStructure.noManager")}
            </span>
          </div>
          {n.children.length > 0 && (
            <TreeRows nodes={n.children} depth={depth + 1} t={t} />
          )}
        </div>
      ))}
    </>
  );
}

export default function HrStructurePage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const workspaceOrgUrl = `${(process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/workspace/workforce/org-structure`;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const tr = await apiFetch("/api/hr/org-structure/tree");
    if (!tr.ok) {
      setError(`${t("hrStructure.loadErr")}: ${tr.status}`);
      setTree([]);
    } else {
      setTree((await tr.json()) as TreeNode[]);
    }
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="w-full max-w-none space-y-8">
      <PageHeader title={t("hrStructure.title")} subtitle={t("hrStructure.subtitle")} />

      <div className={`${CARD_CONTAINER_CLASS} border-l-4 border-l-[#2980B9] p-4`}>
        <p className="text-[13px] font-semibold text-[#34495E]">
          {t("hrStructure.orgCpBannerTitle")}
        </p>
        <p className="mt-1 text-xs text-[#7F8C8D]">{t("hrStructure.orgCpBannerHint")}</p>
        <a
          href={workspaceOrgUrl}
          className="mt-2 inline-block text-[13px] font-medium text-[#2980B9] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("hrStructure.manageOrgInWorkspace")} →
        </a>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section className="bg-white p-6 shadow-sm rounded-xl border border-slate-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("hrStructure.treeTitle")}</h2>
        <p className="mb-4 text-xs text-[#7F8C8D]">{t("hrStructure.mirrorReadOnlyHint")}</p>
        {loading && <TreeSkeleton />}
        {!loading && tree.length === 0 && (
          <EmptyState
            title={t("hrStructure.departmentsEmptyTitle")}
            description={t("hrStructure.departmentsEmptyMirrorHint")}
          />
        )}
        {!loading && tree.length > 0 && <TreeRows nodes={tree} depth={0} t={t} />}
      </section>
    </div>
  );
}
