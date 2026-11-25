"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";

type EstimateMode = "FLAT_BOQ" | "ESTIMATE_HIERARCHY";

type EstLine = {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  qty: string | number;
  unitRate: string | number;
  amountNet: string | number;
};

type EstDoc = {
  id: string;
  kind: string;
  cipher: string;
  title: string;
  chapterNo: number | null;
  amountNet: string | number;
  parentDocumentId: string | null;
  lines: EstLine[];
};

type EstPack = {
  id: string;
  version: number;
  title: string;
  status: string;
  documents: EstDoc[];
};

type PlanFact = {
  lines: Array<{
    itemCode: string;
    description: string;
    plannedAmountNet: number;
    actualAmountNet: number;
    varianceAmountNet: number;
  }>;
  totals: { plannedAmountNet: number; actualAmountNet: number };
  approvedVersion: number | null;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export function ProjectEstimateOps({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("projectsDetail.estimate");
  const tc = useTranslations("common");

  const [mode, setMode] = useState<EstimateMode>("FLAT_BOQ");
  const [financeContractId, setFinanceContractId] = useState("");
  const [packages, setPackages] = useState<EstPack[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [planFact, setPlanFact] = useState<PlanFact | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hierarchySkuOn, setHierarchySkuOn] = useState(true);
  const [rateSkuOn, setRateSkuOn] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [rateItemId, setRateItemId] = useState("");
  const [rateQty, setRateQty] = useState("1");
  const [rateOptions, setRateOptions] = useState<Array<{ value: string; label: string }>>([]);

  const [docKind, setDocKind] = useState("LCR");
  const [docCipher, setDocCipher] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [parentDocId, setParentDocId] = useState("");

  const [lineDocId, setLineDocId] = useState("");
  const [lineCode, setLineCode] = useState("");
  const [lineDesc, setLineDesc] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [lineRate, setLineRate] = useState("0");

  const modeOptions = useMemo(
    () => [
      { value: "FLAT_BOQ", label: t("modeFlat") },
      { value: "ESTIMATE_HIERARCHY", label: t("modeHierarchy") },
    ],
    [t],
  );

  const kindOptions = useMemo(
    () => [
      { value: "SSR", label: t("kindSsr") },
      { value: "OCR", label: t("kindOcr") },
      { value: "LCR", label: t("kindLcr") },
      { value: "SC", label: t("kindSc") },
      { value: "COST_SUMMARY", label: t("kindCostSummary") },
    ],
    [t],
  );

  const selected = packages.find((p) => p.id === selectedId) ?? packages[0] ?? null;

  const load = useCallback(async () => {
    if (!projectId) return;
    const dataRes = await apiJson<{
      estimateMode: EstimateMode;
      financeContractId?: string | null;
      packages: EstPack[];
    }>(`/api/projects/${projectId}/estimate/packages`);
    if (!dataRes.ok) {
      setMessage(dataRes.error || tc("error"));
      return;
    }
    setMode(dataRes.data.estimateMode);
    setFinanceContractId(dataRes.data.financeContractId ?? "");
    const packs = dataRes.data.packages ?? [];
    setPackages(packs);
    setSelectedId((current) => {
      if (current && packs.some((p) => p.id === current)) return current;
      return packs[0]?.id ?? "";
    });

    const pfRes = await apiJson<PlanFact>(
      `/api/projects/${projectId}/estimate/plan-fact`,
    );
    if (pfRes.ok) setPlanFact(pfRes.data);
  }, [projectId, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/platform/billing-snapshot")
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        const mods: string[] = Array.isArray(data?.activeModules)
          ? data.activeModules
          : [];
        const tier = String(data?.tier ?? "").toUpperCase();
        setHierarchySkuOn(
          tier === "TIER_3" || mods.includes("construction_estimate_hierarchy"),
        );
        const rateOn =
          tier === "TIER_3" || mods.includes("construction_smeta_rate_engine");
        setRateSkuOn(rateOn);
        if (!rateOn) {
          setRateOptions([]);
          return;
        }
        const basesRes = await apiJson<{
          items: Array<{ id: string }>;
        }>("/api/rate-bases");
        if (!basesRes.ok || cancelled) return;
        const opts: Array<{ value: string; label: string }> = [];
        for (const base of basesRes.data.items ?? []) {
          const one = await apiJson<{
            items: Array<{
              id: string;
              code: string;
              title: string;
              unitAmount: string | number;
            }>;
          }>(`/api/rate-bases/${base.id}`);
          if (!one.ok || cancelled) continue;
          for (const it of one.data.items ?? []) {
            opts.push({
              value: it.id,
              label: `${it.code} — ${it.title} (${Number(it.unitAmount).toFixed(2)})`,
            });
          }
        }
        if (!cancelled) setRateOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setHierarchySkuOn(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(label);
      await load();
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const parentOptions = (selected?.documents ?? []).map((d) => ({
    value: d.id,
    label: `${d.kind} ${d.cipher}`,
  }));

  const leafDocs = (selected?.documents ?? []).filter(
    (d) => d.kind === "LCR" || d.kind === "SC",
  );
  const leafOptions = leafDocs.map((d) => ({
    value: d.id,
    label: `${d.cipher} — ${d.title}`,
  }));

  const hierarchyBlocked = mode === "ESTIMATE_HIERARCHY" && !hierarchySkuOn;

  function statusLabel(status: string) {
    if (status === "DRAFT") return t("statusDraft");
    if (status === "INTERNAL_REVIEW") return t("statusInternalReview");
    if (status === "EXTERNAL_REVIEW") return t("statusExternalReview");
    if (status === "APPROVED") return t("statusApproved");
    if (status === "SUPERSEDED") return t("statusSuperseded");
    return status;
  }

  function nextStepHint(status: string) {
    if (status === "DRAFT") return t("nextStepInternal");
    if (status === "INTERNAL_REVIEW") return t("nextStepExternal");
    if (status === "EXTERNAL_REVIEW") return t("nextStepApprove");
    if (status === "APPROVED") return t("nextStepDone");
    return "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[16px] font-semibold text-[#2C3E50]">{t("title")}</h2>
        <p className="text-[12px] text-[#5D6D7E]">{t("subtitle")}</p>
      </div>

      <div className={FORM_STACK_CLASS}>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("mode")}
          value={mode}
          onChange={(v) => setMode(String(v) as EstimateMode)}
          options={modeOptions}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() =>
            run(t("modeSaved"), async () => {
              const res = await apiJson(`/api/projects/${projectId}/estimate/mode`, {
                method: "PATCH",
                headers: JSON_HEADERS,
                body: JSON.stringify({ estimateMode: mode }),
              });
              if (!res.ok) throw new Error(res.error || tc("error"));
            })
          }
        >
          {t("saveMode")}
        </button>
        <Field
          preset="code"
          label={t("financeContractId")}
          value={financeContractId}
          onChange={(e) => setFinanceContractId(e.target.value)}
          hint={t("financeContractHint")}
        />
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-[12px]"
          disabled={busy}
          onClick={() =>
            run(t("financeContractSaved"), async () => {
              const res = await apiJson(
                `/api/projects/${projectId}/estimate/finance-contract`,
                {
                  method: "PATCH",
                  headers: JSON_HEADERS,
                  body: JSON.stringify({
                    financeContractId: financeContractId.trim() || null,
                  }),
                },
              );
              if (!res.ok) throw new Error(res.error || tc("error"));
            })
          }
        >
          {t("saveFinanceContract")}
        </button>
      </div>

      {mode === "FLAT_BOQ" ? (
        <p className="rounded border border-[#D5D8DC] bg-[#F8F9F9] p-3 text-[12px] text-[#5D6D7E]">
          {t("flatHint")}
        </p>
      ) : hierarchyBlocked ? (
        <p className="rounded border border-[#F5B7B1] bg-[#FDEDEC] p-3 text-[12px] text-[#922B21]">
          {t("skuOff")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() =>
                run(t("packCreated"), async () => {
                  const contractId = financeContractId.trim();
                  if (contractId) {
                    const link = await apiJson(
                      `/api/projects/${projectId}/estimate/finance-contract`,
                      {
                        method: "PATCH",
                        headers: JSON_HEADERS,
                        body: JSON.stringify({ financeContractId: contractId }),
                      },
                    );
                    if (!link.ok) throw new Error(link.error || tc("error"));
                  }
                  const res = await apiJson<EstPack>(
                    `/api/projects/${projectId}/estimate/packages`,
                    {
                      method: "POST",
                      headers: JSON_HEADERS,
                      body: JSON.stringify({
                        ...(contractId ? { financeContractId: contractId } : {}),
                      }),
                    },
                  );
                  if (!res.ok) throw new Error(res.error || tc("error"));
                  setSelectedId(res.data.id);
                })
              }
            >
              {t("newPack")}
            </button>
            {selected ? (
              <>
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-[12px]"
                  disabled={busy || selected.status !== "DRAFT"}
                  onClick={() =>
                    run(t("statusChanged"), async () => {
                      const res = await apiJson(
                        `/api/estimate-packages/${selected.id}/transition`,
                        {
                          method: "POST",
                          headers: JSON_HEADERS,
                          body: JSON.stringify({ status: "INTERNAL_REVIEW" }),
                        },
                      );
                      if (!res.ok) throw new Error(res.error || tc("error"));
                    })
                  }
                >
                  {t("toInternalReview")}
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-[12px]"
                  disabled={busy || selected.status !== "INTERNAL_REVIEW"}
                  onClick={() =>
                    run(t("statusChanged"), async () => {
                      const res = await apiJson(
                        `/api/estimate-packages/${selected.id}/transition`,
                        {
                          method: "POST",
                          headers: JSON_HEADERS,
                          body: JSON.stringify({ status: "EXTERNAL_REVIEW" }),
                        },
                      );
                      if (!res.ok) throw new Error(res.error || tc("error"));
                    })
                  }
                >
                  {t("toExternalReview")}
                </button>
                <button
                  type="button"
                  className="rounded border border-green-700 px-3 py-1.5 text-[12px] text-green-800"
                  disabled={busy || selected.status !== "EXTERNAL_REVIEW"}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      setMessage("");
                      try {
                        const res = await apiJson<{
                          sovSeedEligible?: boolean;
                          financeContractId?: string | null;
                          eventHint?: { financeContractId?: string };
                        }>(`/api/estimate-packages/${selected.id}/transition`, {
                          method: "POST",
                          headers: JSON_HEADERS,
                          body: JSON.stringify({ status: "APPROVED" }),
                        });
                        if (!res.ok) throw new Error(res.error || tc("error"));
                        const contractId =
                          res.data?.financeContractId ||
                          res.data?.eventHint?.financeContractId ||
                          financeContractId.trim() ||
                          "";
                        const eligible =
                          res.data?.sovSeedEligible === true || Boolean(contractId);
                        setMessage(
                          eligible
                            ? `${t("approvedWithSov", { contractId })} ${t("financeSovVerifyHint", { contractId })}`
                            : t("approvedNoSov"),
                        );
                        await load();
                        onChanged?.();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : String(e));
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  {t("approve")}
                </button>
              </>
            ) : null}
          </div>
          {selected ? (
            <p className="text-[11px] text-[#5D6D7E]">{nextStepHint(selected.status)}</p>
          ) : null}

          {packages.length > 0 ? (
            <CatalogField
              kind="CLOSED_MEDIUM"
              label={t("selectPack")}
              value={selected?.id ?? ""}
              onChange={(v) => setSelectedId(String(v))}
              options={packages.map((p) => ({
                value: p.id,
                label: `v${p.version} · ${statusLabel(p.status)} · ${p.title}`,
              }))}
            />
          ) : (
            <p className="rounded border border-[#D5D8DC] bg-[#F8F9F9] p-3 text-[12px] text-[#5D6D7E]">
              {t("noPacks")}
            </p>
          )}

          {selected ? (
            <div className="space-y-4 rounded border border-[#D5D8DC] p-3">
              <p className="text-[12px]">
                <strong>v{selected.version}</strong> · {statusLabel(selected.status)} ·{" "}
                {selected.title}
              </p>

              <ul className="space-y-1 text-[12px]">
                {selected.documents.map((d) => (
                  <li key={d.id} className="border-b border-[#EEEEEE] py-1">
                    <span className="font-medium">{d.kind}</span> {d.cipher} — {d.title}
                    {d.chapterNo != null ? ` · ch.${d.chapterNo}` : ""} ·{" "}
                    {Number(d.amountNet).toFixed(2)} AZN
                    {d.lines?.length ? (
                      <ul className="ml-4 mt-1 text-[#5D6D7E]">
                        {d.lines.map((l) => (
                          <li key={l.id}>
                            {l.itemCode}: {l.description} · {Number(l.qty)} ×{" "}
                            {Number(l.unitRate)} = {Number(l.amountNet).toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className={FORM_STACK_CLASS}>
                <h3 className="text-[13px] font-medium">{t("addDoc")}</h3>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("docKind")}
                  value={docKind}
                  onChange={(v) => setDocKind(String(v))}
                  options={kindOptions}
                />
                <FieldRow>
                  <Field
                    label={t("cipher")}
                    value={docCipher}
                    onChange={(e) => setDocCipher(e.target.value)}
                  />
                  <Field
                    label={t("docTitle")}
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                  />
                </FieldRow>
                {parentOptions.length > 0 ? (
                  <CatalogField
                    kind="SEARCHABLE"
                    label={t("parentDoc")}
                    value={parentDocId}
                    onChange={(v) => setParentDocId(String(v))}
                    options={[{ value: "", label: "—" }, ...parentOptions]}
                  />
                ) : null}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() =>
                    run(t("docSaved"), async () => {
                      const res = await apiJson(
                        `/api/estimate-packages/${selected.id}/documents`,
                        {
                          method: "POST",
                          headers: JSON_HEADERS,
                          body: JSON.stringify({
                            kind: docKind,
                            cipher: docCipher,
                            title: docTitle,
                            parentDocumentId: parentDocId || null,
                          }),
                        },
                      );
                      if (!res.ok) throw new Error(res.error || tc("error"));
                      setDocCipher("");
                      setDocTitle("");
                    })
                  }
                >
                  {t("saveDoc")}
                </button>
              </div>

              <div className={FORM_STACK_CLASS}>
                <h3 className="text-[13px] font-medium">{t("addLines")}</h3>
                {leafOptions.length === 0 ? (
                  <p className="rounded border border-[#D5D8DC] bg-[#F8F9F9] p-3 text-[12px] text-[#5D6D7E]">
                    {t("noLeafDocs")}
                  </p>
                ) : (
                  <>
                    <CatalogField
                      kind="CLOSED_MEDIUM"
                      label={t("leafDoc")}
                      value={lineDocId}
                      onChange={(v) => setLineDocId(String(v))}
                      options={leafOptions}
                    />
                    <FieldRow>
                      <Field
                        label={t("itemCode")}
                        value={lineCode}
                        onChange={(e) => setLineCode(e.target.value)}
                      />
                      <Field
                        label={t("description")}
                        value={lineDesc}
                        onChange={(e) => setLineDesc(e.target.value)}
                      />
                    </FieldRow>
                    <FieldRow>
                      <Field
                        label={t("qty")}
                        value={lineQty}
                        onChange={(e) => setLineQty(e.target.value)}
                      />
                      <Field
                        label={t("unitRate")}
                        value={lineRate}
                        onChange={(e) => setLineRate(e.target.value)}
                      />
                    </FieldRow>
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy || !lineDocId}
                      onClick={() =>
                        run(t("linesSaved"), async () => {
                          const existing =
                            leafDocs.find((d) => d.id === lineDocId)?.lines ?? [];
                          const next = [
                            ...existing.map((l) => ({
                              itemCode: l.itemCode,
                              description: l.description,
                              unit: l.unit,
                              qty: Number(l.qty),
                              unitRate: Number(l.unitRate),
                              amountNet: Number(l.amountNet),
                            })),
                            {
                              itemCode: lineCode,
                              description: lineDesc,
                              qty: Number(lineQty),
                              unitRate: Number(lineRate),
                            },
                          ];
                          const res = await apiJson(
                            `/api/estimate-documents/${lineDocId}/lines`,
                            {
                              method: "PUT",
                              headers: JSON_HEADERS,
                              body: JSON.stringify({ lines: next }),
                            },
                          );
                          if (!res.ok) throw new Error(res.error || tc("error"));
                          setLineCode("");
                          setLineDesc("");
                        })
                      }
                    >
                      {t("saveLines")}
                    </button>
                    <Field
                      preset="longText"
                      label={t("csvImport")}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      hint={t("csvImportHint")}
                    />
                    <button
                      type="button"
                      className="rounded border px-3 py-1.5 text-[12px]"
                      disabled={busy || !lineDocId || !csvText.trim()}
                      onClick={() =>
                        run(t("csvImported"), async () => {
                          const res = await apiJson(
                            `/api/estimate-documents/${lineDocId}/lines/import-csv`,
                            {
                              method: "POST",
                              headers: JSON_HEADERS,
                              body: JSON.stringify({ csv: csvText }),
                            },
                          );
                          if (!res.ok) throw new Error(res.error || tc("error"));
                          setCsvText("");
                        })
                      }
                    >
                      {t("importCsv")}
                    </button>
                  </>
                )}
                {rateSkuOn ? (
                  <div className={FORM_STACK_CLASS}>
                    <h3 className="text-[13px] font-medium">{t("applyRate")}</h3>
                    {rateOptions.length === 0 ? (
                      <p className="text-[12px] text-[#5D6D7E]">
                        {t("rateBasesEmpty")}{" "}
                        <a className="underline" href="/admin/rate-bases">
                          /admin/rate-bases
                        </a>
                      </p>
                    ) : (
                      <>
                        <CatalogField
                          kind="SEARCHABLE"
                          label={t("rateItem")}
                          value={rateItemId}
                          onChange={(v) => setRateItemId(String(v))}
                          options={rateOptions}
                        />
                        <Field
                          label={t("qty")}
                          value={rateQty}
                          onChange={(e) => setRateQty(e.target.value)}
                        />
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          disabled={busy || !lineDocId || !rateItemId}
                          onClick={() =>
                            run(t("rateApplied"), async () => {
                              const res = await apiJson("/api/rate-engine/apply", {
                                method: "POST",
                                headers: JSON_HEADERS,
                                body: JSON.stringify({
                                  documentId: lineDocId,
                                  rateItemId,
                                  qty: Number(rateQty),
                                }),
                              });
                              if (!res.ok) throw new Error(res.error || tc("error"));
                            })
                          }
                        >
                          {t("applyRate")}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="rounded border border-[#D5D8DC] bg-[#F8F9F9] p-3 text-[12px] text-[#5D6D7E]">
                    {t("rateSkuOff")}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      {planFact ? (
        <div className="rounded border border-[#D6EAF8] p-3">
          <h3 className="text-[13px] font-medium text-[#1A5276]">{t("planFact")}</h3>
          {planFact.approvedVersion == null ? (
            <p className="mt-1 text-[12px] text-[#5D6D7E]">{t("planFactNoApproved")}</p>
          ) : (
            <>
              <p className="text-[11px] text-[#5D6D7E]">
                {t("approvedVersion")}: {planFact.approvedVersion} · {t("planned")}:{" "}
                {planFact.totals.plannedAmountNet.toFixed(2)} · {t("actual")}:{" "}
                {planFact.totals.actualAmountNet.toFixed(2)}
              </p>
              <ul className="mt-2 space-y-1 text-[11px]">
                {planFact.lines.slice(0, 40).map((l) => (
                  <li key={l.itemCode}>
                    {l.itemCode}: plan {l.plannedAmountNet.toFixed(2)} / fact{" "}
                    {l.actualAmountNet.toFixed(2)} (Δ {l.varianceAmountNet.toFixed(2)})
                  </li>
                ))}
              </ul>
            </>
          )}
          {!financeContractId.trim() ? (
            <p className="mt-2 text-[11px] text-[#922B21]">{t("sovNeedsContractHint")}</p>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-[12px] text-[#1A5276]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
