"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type ComponentRow = {
  id: string;
  code: string;
  kind: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  isActive: boolean;
};

export default function PayrollComponentsPage() {
  const { t } = useTranslation();
  const { token } = useRequireAuth();
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/hr/payroll-components");
    if (!res.ok) {
      toast.error("Failed to load components");
      return;
    }
    setRows((await res.json()) as ComponentRow[]);
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("payroll.componentsAdmin", { defaultValue: "Payroll components" })} />
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="m-0 text-sm font-semibold text-[#34495E]">
          {t("payroll.addComponent", { defaultValue: "Add custom component" })}
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[13px]">
            Code
            <input
              className={`mt-1 block ${INPUT_BORDERED_CLASS}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CUSTOM_BONUS"
            />
          </label>
          <label className="text-[13px]">
            Kind
            <select
              className={`mt-1 block ${INPUT_BORDERED_CLASS}`}
              value={kind}
              onChange={(e) => setKind(e.target.value as "EARNING" | "DEDUCTION")}
            >
              <option value="EARNING">EARNING</option>
              <option value="DEDUCTION">DEDUCTION</option>
            </select>
          </label>
          <label className="text-[13px]">
            Name (EN)
            <input
              className={`mt-1 block ${INPUT_BORDERED_CLASS}`}
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !code.trim() || !nameEn.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const label = nameEn.trim();
                const res = await apiFetch("/api/hr/payroll-components", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    code: code.trim(),
                    kind,
                    nameAz: label,
                    nameRu: label,
                    nameEn: label,
                  }),
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success(t("common.saved", { defaultValue: "Saved" }));
                setCode("");
                setNameEn("");
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("common.add", { defaultValue: "Add" })}
          </button>
          <a href="/payroll" className={SECONDARY_BUTTON_CLASS}>
            {t("common.back", { defaultValue: "Back" })}
          </a>
        </div>
      </section>
      <div className="overflow-x-auto">
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Code</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Kind</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Name</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.kind}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.nameEn || r.nameAz}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.isActive ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
