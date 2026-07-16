"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiBaseUrl, apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";
import { Download, Loader2 } from "lucide-react";

type StatDefinition = {
  id: string;
  code: string;
  name: string;
  periodKind: "YEAR" | "QUARTER" | "MONTH";
  version: number;
};

type StatExport = {
  id: string;
  period: string;
  status: string;
  createdAt: string;
  definition: { code: string; name: string; periodKind: string };
};

function defaultPeriod(kind: StatDefinition["periodKind"]): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  if (kind === "YEAR") return String(y);
  if (kind === "MONTH") return `${y}-${m}`;
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

export default function StatformsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [definitions, setDefinitions] = useState<StatDefinition[]>([]);
  const [exports, setExports] = useState<StatExport[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const selectedDef = useMemo(
    () => definitions.find((d) => d.code === selectedCode) ?? null,
    [definitions, selectedCode],
  );

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [defRes, expRes] = await Promise.all([
      apiFetch("/api/reporting/statforms/definitions"),
      apiFetch("/api/reporting/statforms/exports"),
    ]);
    if (defRes.ok) {
      const defs = (await defRes.json()) as StatDefinition[];
      setDefinitions(defs);
      if (!selectedCode && defs[0]) {
        setSelectedCode(defs[0].code);
        setPeriod(defaultPeriod(defs[0].periodKind));
      }
    }
    if (expRes.ok) {
      setExports((await expRes.json()) as StatExport[]);
    }
    setLoading(false);
  }, [token, selectedCode]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  useEffect(() => {
    if (selectedDef) {
      setPeriod(defaultPeriod(selectedDef.periodKind));
    }
  }, [selectedDef?.code, selectedDef?.periodKind]);

  const generate = async () => {
    if (!selectedCode || !period.trim()) return;
    setGenerating(true);
    const res = await apiFetch("/api/reporting/statforms/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        definitionCode: selectedCode,
        period: period.trim(),
      }),
    });
    setGenerating(false);
    if (!res.ok) {
      toast.error(t("reporting.statforms.generateErr"));
      return;
    }
    toast.success(t("reporting.statforms.generateOk"));
    void load();
  };

  const downloadUrl = (id: string) =>
    `${apiBaseUrl()}/api/reporting/statforms/exports/${id}/download`;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title={t("reporting.statforms.title")}
        subtitle={t("reporting.statforms.subtitle")}
      />

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">
          {t("reporting.statforms.generateTitle")}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("reporting.statforms.formLabel")}
            </label>
            <select
              className={MODAL_INPUT_CLASS}
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
            >
              {definitions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} тАФ {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("reporting.statforms.periodLabel")}
            </label>
            <input
              className={MODAL_INPUT_CLASS}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder={
                selectedDef?.periodKind === "YEAR"
                  ? "2026"
                  : selectedDef?.periodKind === "QUARTER"
                    ? "2026-Q1"
                    : "2026-01"
              }
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={generating || !selectedCode}
              onClick={() => void generate()}
            >
              {generating ? (
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              ) : null}
              {t("reporting.statforms.generateBtn")}
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("reporting.statforms.periodHint")}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          {t("reporting.statforms.exportsTitle")}
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("reporting.statforms.loading")}
          </div>
        ) : exports.length === 0 ? (
          <p className="text-muted-foreground">{t("reporting.statforms.empty")}</p>
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("reporting.statforms.colForm")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("reporting.statforms.colPeriod")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("reporting.statforms.colStatus")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("reporting.statforms.colCreated")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS} />
                </tr>
              </thead>
              <tbody>
                {exports.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.definition.code}
                      <div className="text-xs text-muted-foreground">
                        {row.definition.name}
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.period}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <a
                        href={downloadUrl(row.id)}
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        title={t("reporting.statforms.download")}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Link href="/reporting" className={SECONDARY_BUTTON_CLASS}>
        {t("reporting.statforms.back")}
      </Link>
    </div>
  );
}
