"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
import type { Brigade, Employment } from "../_lib/types";

export default function WorkforceBrigadesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [brigadeOpen, setBrigadeOpen] = useState(false);
  const [brigadeEditId, setBrigadeEditId] = useState<string | null>(null);
  const [brigadeCode, setBrigadeCode] = useState("");
  const [brigadeName, setBrigadeName] = useState("");
  const [brigadeMemberIds, setBrigadeMemberIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [bRes, eRes] = await Promise.all([
      wfFetch("brigades"),
      wfFetch("employments?status=ACTIVE&pageSize=200"),
    ]);
    if (await isWorkforceGate403(bRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (bRes.ok) setBrigades(await bRes.json());
    else setError(t("loadError"));
    if (eRes.ok) {
      const body = await eRes.json();
      setEmployments(Array.isArray(body) ? body : (body.items ?? []));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function saveBrigade() {
    if (!brigadeName.trim() || (!brigadeEditId && !brigadeCode.trim())) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = brigadeEditId
      ? await wfFetch(`brigades/${brigadeEditId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: brigadeName.trim(),
            employmentIds: brigadeMemberIds,
          }),
        })
      : await wfFetch("brigades", {
          method: "POST",
          body: JSON.stringify({
            code: brigadeCode.trim(),
            name: brigadeName.trim(),
            employmentIds: brigadeMemberIds,
          }),
        });
    setBusy(false);
    if (!res.ok) {
      setFormError(t("saveError"));
      return;
    }
    setBrigadeOpen(false);
    await load();
  }

  function openCreateBrigade() {
    setBrigadeEditId(null);
    setBrigadeCode("");
    setBrigadeName("");
    setBrigadeMemberIds([]);
    setFormError(null);
    setBrigadeOpen(true);
  }

  function openEditBrigade(row: Brigade) {
    setBrigadeEditId(row.id);
    setBrigadeCode(row.code);
    setBrigadeName(row.name);
    setBrigadeMemberIds((row.members ?? []).map((m) => m.employmentId));
    setFormError(null);
    setBrigadeOpen(true);
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const empOptions = employments.map((e) => ({
    value: e.id,
    label: e.staffCode ?? e.id.slice(0, 8),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("brigadesHeading")} subtitle={t("shiftsHint")} />
      <WorkforceShiftsSubnav />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--era-muted)]">{tCommon("loading")}</p>
      ) : (
        <section className={CARD_CONTAINER_CLASS}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t("brigadesHeading")}</h2>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={openCreateBrigade}
            >
              <Plus className="h-4 w-4" />
              {t("addBrigade")}
            </button>
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colMembers")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS} />
                </tr>
              </thead>
              <tbody>
                {brigades.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row._count?.members ?? row.members?.length ?? 0}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => openEditBrigade(row)}
                      >
                        {tCommon("edit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ModalShell
        open={brigadeOpen}
        onClose={() => setBrigadeOpen(false)}
        title={brigadeEditId ? t("editBrigade") : t("addBrigade")}
      >
        <div className="space-y-3">
          {!brigadeEditId ? (
            <CatalogField
              kind="FREE_TEXT"
              label={t("colCode")}
              value={brigadeCode}
              onChange={(v) => setBrigadeCode(String(v))}
              options={[]}
            />
          ) : null}
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={brigadeName}
            onChange={(v) => setBrigadeName(String(v))}
            options={[]}
          />
          <CatalogField
            kind="MULTI"
            label={t("colMembers")}
            value={brigadeMemberIds}
            onChange={(v) =>
              setBrigadeMemberIds(Array.isArray(v) ? v.map(String) : [])
            }
            options={empOptions}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setBrigadeOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void saveBrigade()}
            >
              {tCommon("save")}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
