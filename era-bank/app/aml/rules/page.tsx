"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsDataTable, OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, StatusBadge } from "@/components/ops-ui";

type AmlRule = {
  id: string;
  code: string;
  enabled: boolean;
  paramsJson: Record<string, unknown>;
  updatedAt?: string;
};

function AmlRulesPageInner() {
  const tCommon = useTranslations("common");
  const { mode, entityId, open, close, isOpen } = useOpsModal();
  const [rows, setRows] = useState<AmlRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [paramsText, setParamsText] = useState("{}");

  const selected = useMemo(
    () => rows.find((r) => r.code === entityId),
    [rows, entityId],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/aml/rules", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as AmlRule[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "edit" && selected) {
      setEnabled(selected.enabled);
      setParamsText(JSON.stringify(selected.paramsJson ?? {}, null, 2));
    }
  }, [mode, selected]);

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId) return;
    setBusy(true);
    setError(null);
    try {
      let paramsJson: Record<string, unknown>;
      try {
        paramsJson = JSON.parse(paramsText) as Record<string, unknown>;
      } catch {
        setError("Invalid JSON in params");
        return;
      }
      const res = await fetch(`/api/aml/rules/${encodeURIComponent(entityId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, paramsJson }),
      });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      close();
      await load();
    } catch {
      setError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AML rules" subtitle="Configure monitoring rule parameters" />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
        <Link href="/aml/alerts" className="text-sm text-primary underline">
          Alert queue
        </Link>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel={tCommon("empty")}
          onRowClick={(row) => open("edit", row.code)}
          columns={[
            { key: "code", label: "Code" },
            {
              key: "enabled",
              label: "Enabled",
              render: (row) =>
                row.enabled ? (
                  <StatusBadge status="ACTIVE" />
                ) : (
                  <StatusBadge status="DRAFT" />
                ),
            },
            {
              key: "updatedAt",
              label: "Updated",
              render: (row) => row.updatedAt?.slice(0, 19) ?? "—",
            },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "edit"}
        title={`Edit rule — ${entityId ?? ""}`}
        onClose={close}
        formId="aml-rule-form"
        onSubmit={() => {}}
        submitLabel="Save rule"
        busy={busy}
      >
        <form id="aml-rule-form" onSubmit={(e) => void saveRule(e)} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Rule enabled
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">paramsJson</span>
            <textarea
              className="min-h-[160px] w-full rounded border px-3 py-2 font-mono text-xs"
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
            />
          </label>
        </form>
      </OpsModalShell>
    </div>
  );
}

export default function AmlRulesPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <AmlRulesPageInner />
    </Suspense>
  );
}
