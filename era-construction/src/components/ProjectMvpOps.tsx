"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  Field,
  FieldRow,
  FieldTextarea,
  FORM_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { punchStatusOptions } from "@/lib/punch-status";
import { apiJson } from "@/lib/client-api";

type BoqLine = {
  id: string;
  itemCode: string;
  description: string;
  plannedQty: string | number;
  plannedAmountNet: string | number;
};

type ActLine = {
  id?: string;
  itemCode: string;
  description: string;
  qty: number;
  amountNet: number;
  boqLineId?: string | null;
};

type ProgressAct = {
  id: string;
  status: string;
  periodKey: string | null;
  amountNet: string | number;
  financeContractId?: string | null;
  financePayAppId?: string | null;
  lines: ActLine[];
};

type DailyLog = {
  id: string;
  logDate: string;
  weather: string | null;
  crewCount: number | null;
  notes: string | null;
  status?: string;
};

type PunchItem = {
  id: string;
  location: string;
  description: string;
  status: string;
  ifcElementId?: string | null;
  externalViewerUrl?: string | null;
};

type Party = { id: string; role: string; displayName: string };

export function ProjectMvpOps({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("projectsDetail.mvp");
  const tc = useTranslations("common");

  const [boq, setBoq] = useState<BoqLine[]>([]);
  const [acts, setActs] = useState<ProgressAct[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [punches, setPunches] = useState<PunchItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [boqCode, setBoqCode] = useState("");
  const [boqDesc, setBoqDesc] = useState("");
  const [boqQty, setBoqQty] = useState("1");
  const [boqAmount, setBoqAmount] = useState("0");

  const [periodKey, setPeriodKey] = useState("");
  const [selectedActId, setSelectedActId] = useState("");
  const [draftLines, setDraftLines] = useState<ActLine[]>([]);
  const [payAppIdDraft, setPayAppIdDraft] = useState("");
  const linesDirtyRef = useRef(false);

  const [logDate, setLogDate] = useState("");
  const [weather, setWeather] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [equipmentNotes, setEquipmentNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [punchLocation, setPunchLocation] = useState("");
  const [punchDesc, setPunchDesc] = useState("");
  const [punchAssignee, setPunchAssignee] = useState("");
  const [punchSheetId, setPunchSheetId] = useState("");
  const [punchPinX, setPunchPinX] = useState("");
  const [punchPinY, setPunchPinY] = useState("");
  const [punchIfc, setPunchIfc] = useState("");
  const [punchViewerUrl, setPunchViewerUrl] = useState("");
  const [bimEnabled, setBimEnabled] = useState(true);
  const [sheets, setSheets] = useState<Array<{ id: string; drawingCode: string; revision: string; status: string }>>(
    [],
  );
  const [parties, setParties] = useState<Party[]>([]);
  const [crewPartyId, setCrewPartyId] = useState("");
  const [crewPartyCount, setCrewPartyCount] = useState("");

  function syncDraftLinesFromAct(act: ProgressAct | undefined) {
    setDraftLines(
      (act?.lines ?? []).map((l) => ({
        itemCode: l.itemCode,
        description: l.description,
        qty: Number(l.qty),
        amountNet: Number(l.amountNet),
        boqLineId: l.boqLineId ?? null,
      })),
    );
  }

  function markLinesDirty() {
    linesDirtyRef.current = true;
  }

  const load = useCallback(async () => {
    if (!projectId) return;
    const [boqRes, actsRes, logsRes, punchRes, sheetsRes, partiesRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/boq`),
      fetch(`/api/projects/${projectId}/acts`),
      fetch(`/api/projects/${projectId}/daily-logs`),
      fetch(`/api/projects/${projectId}/punch-list`),
      fetch(`/api/cde/documents?projectId=${encodeURIComponent(projectId)}`),
      fetch(`/api/projects/${projectId}/parties`),
    ]);
    const boqData = await boqRes.json();
    const actsData = await actsRes.json();
    const logsData = await logsRes.json();
    const punchData = await punchRes.json();
    const sheetsData = await sheetsRes.json();
    const partiesData = await partiesRes.json();
    if (boqRes.ok) setBoq(Array.isArray(boqData) ? boqData : []);
    if (actsRes.ok) {
      const list: ProgressAct[] = Array.isArray(actsData) ? actsData : [];
      setActs(list);
      setSelectedActId((current) => {
        if (current && list.some((a) => a.id === current)) return current;
        return (list.find((a) => a.status === "DRAFT") ?? list[0])?.id ?? "";
      });
    }
    if (logsRes.ok) setLogs(Array.isArray(logsData) ? logsData : []);
    if (punchRes.ok) setPunches(Array.isArray(punchData) ? punchData : []);
    if (sheetsRes.ok) {
      const docs = Array.isArray(sheetsData.documents) ? sheetsData.documents : [];
      setSheets(docs.filter((d: { status: string }) => d.status === "CURRENT"));
    }
    if (partiesRes.ok) setParties(Array.isArray(partiesData) ? partiesData : []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/platform/billing-snapshot")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const mods: string[] = Array.isArray(data?.activeModules)
          ? data.activeModules
          : [];
        const tier = String(data?.tier ?? "").toUpperCase();
        setBimEnabled(tier === "TIER_3" || mods.includes("construction_bim_lite"));
      })
      .catch(() => {
        if (!cancelled) setBimEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync server lines into the editor only when the selection changes or after a
  // clean reload — never wipe unsaved edits when BOQ/daily/punch refreshes acts.
  useEffect(() => {
    if (linesDirtyRef.current) return;
    const act = acts.find((a) => a.id === selectedActId);
    syncDraftLinesFromAct(act);
    if (act) setPayAppIdDraft(act.financePayAppId ?? "");
  }, [acts, selectedActId]);

  function selectAct(actId: string) {
    linesDirtyRef.current = false;
    setSelectedActId(actId);
    const act = acts.find((a) => a.id === actId);
    setPayAppIdDraft(act?.financePayAppId ?? "");
  }

  const selectedAct = acts.find((a) => a.id === selectedActId);
  const actEditable = selectedAct?.status === "DRAFT";
  const draftLinesTotal = draftLines.reduce((sum, l) => sum + Number(l.amountNet), 0);
  const actApprovedLocked = selectedAct?.status === "APPROVED";

  function actStatusLabel(status: string) {
    if (status === "DRAFT") return t("actStatusDraft");
    if (status === "APPROVED") return t("actStatusApproved");
    return status;
  }

  async function saveBoq(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/projects/${projectId}/boq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemCode: boqCode.trim(),
        description: boqDesc.trim() || boqCode.trim(),
        plannedQty: Number(boqQty) || 1,
        plannedAmountNet: Number(boqAmount) || 0,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    setBoqCode("");
    setBoqDesc("");
    setBoqQty("1");
    setBoqAmount("0");
    setMessage(t("boqSaved"));
    await load();
    onChanged?.();
  }

  async function createAct() {
    setBusy(true);
    setMessage("");
    const res = await apiJson<{ id: string }>(`/api/projects/${projectId}/acts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodKey: periodKey.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    setPeriodKey("");
    linesDirtyRef.current = false;
    setSelectedActId(res.data.id);
    setDraftLines([]);
    setMessage(t("actCreated"));
    await load();
    onChanged?.();
  }

  function addDraftLineFromBoq(line: BoqLine) {
    markLinesDirty();
    setDraftLines((prev) => [
      ...prev,
      {
        itemCode: line.itemCode,
        description: line.description,
        qty: Number(line.plannedQty) || 1,
        amountNet: Number(line.plannedAmountNet) || 0,
        boqLineId: line.id,
      },
    ]);
  }

  function updateDraftLine(index: number, patch: Partial<ActLine>) {
    markLinesDirty();
    setDraftLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeDraftLine(index: number) {
    markLinesDirty();
    setDraftLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveLines(): Promise<boolean> {
    if (!selectedActId) return false;
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/progress-acts/${selectedActId}/lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: draftLines.map((l, index) => ({
          itemCode: l.itemCode,
          description: l.description,
          qty: Number(l.qty),
          amountNet: Number(l.amountNet),
          boqLineId: l.boqLineId || undefined,
          sortOrder: index,
        })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = res.error || tc("error");
      setMessage(
        res.status === 409 || /already approved/i.test(err) ? t("actApprovedLocked") : err,
      );
      return false;
    }
    linesDirtyRef.current = false;
    setMessage(t("linesSaved"));
    await load();
    onChanged?.();
    return true;
  }

  async function approveAct() {
    if (!selectedActId) return;
    if (actApprovedLocked) {
      setMessage(t("actApprovedLocked"));
      return;
    }
    let amount = Number(selectedAct?.amountNet ?? 0);
    if (linesDirtyRef.current) {
      if (draftLines.length === 0) {
        setMessage(t("saveLinesFirst"));
        return;
      }
      amount = draftLines.reduce((sum, l) => sum + Number(l.amountNet), 0);
      const saved = await saveLines();
      if (!saved) return;
    }
    if (amount <= 0 || draftLines.length === 0) {
      setMessage(draftLines.length === 0 ? t("actLinesEmpty") : t("approveNeedsAmount"));
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/progress-acts/${selectedActId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      const err = res.error || tc("error");
      setMessage(
        res.status === 409 || /already approved/i.test(err) ? t("actApprovedLocked") : err,
      );
      return;
    }
    linesDirtyRef.current = false;
    setMessage(
      `${t("actApprovedFinance", { actId: selectedActId })} ${t("actJournalVerifyHint", { actId: selectedActId })}`,
    );
    await load();
    onChanged?.();
  }

  async function savePayAppRef() {
    if (!selectedActId) return;
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/progress-acts/${selectedActId}/finance-payapp`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ financePayAppId: payAppIdDraft.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    setMessage(t("financePayAppSaved"));
    await load();
    onChanged?.();
  }

  async function saveDailyLog(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const crewByPartyJson =
      crewPartyId && crewPartyCount
        ? JSON.stringify({ [crewPartyId]: Number(crewPartyCount) || 0 })
        : undefined;
    const res = await apiJson(`/api/projects/${projectId}/daily-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate,
        weather: weather || undefined,
        crewCount: crewCount ? Number(crewCount) : undefined,
        notes: logNotes || undefined,
        equipmentNotes: equipmentNotes || undefined,
        photoUrl: photoUrl || undefined,
        crewByPartyJson,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    setLogDate("");
    setWeather("");
    setCrewCount("");
    setLogNotes("");
    setEquipmentNotes("");
    setPhotoUrl("");
    setCrewPartyId("");
    setCrewPartyCount("");
    setMessage(t("logSaved"));
    await load();
  }

  async function submitLog(logId: string) {
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/daily-logs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, action: "SUBMIT" }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    setMessage(t("logSubmitted"));
    await load();
  }

  async function savePunch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const viewer = punchViewerUrl.trim();
    if (bimEnabled && viewer && !/^https?:\/\//i.test(viewer)) {
      setBusy(false);
      setMessage(t("bimViewerInvalid"));
      return;
    }
    const res = await apiJson(`/api/projects/${projectId}/punch-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: punchLocation.trim(),
        description: punchDesc.trim(),
        assignee: punchAssignee.trim() || undefined,
        drawingRevisionId: punchSheetId || undefined,
        pinX: punchPinX ? Number(punchPinX) : undefined,
        pinY: punchPinY ? Number(punchPinY) : undefined,
        ifcElementId: bimEnabled ? punchIfc.trim() || undefined : undefined,
        externalViewerUrl: bimEnabled ? viewer || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    setPunchLocation("");
    setPunchDesc("");
    setPunchAssignee("");
    setPunchSheetId("");
    setPunchPinX("");
    setPunchPinY("");
    setPunchIfc("");
    setPunchViewerUrl("");
    setMessage(t("punchSaved"));
    await load();
  }

  async function updatePunchStatus(itemId: string, status: string) {
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/punch-list`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, status }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6 border-t pt-4">
      <div>
        <h2 className="text-[13px] font-semibold">{t("title")}</h2>
        <p className="mt-1 text-[12px] text-[#7F8C8D]">{t("subtitle")}</p>
        {message ? <p className="mt-2 text-[13px]">{message}</p> : null}
      </div>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("boqTitle")}</h3>
        {boq.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("boqEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {boq.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1">
                <span>
                  {line.itemCode} — {line.description} ({Number(line.plannedQty)})
                </span>
                {actEditable ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => addDraftLineFromBoq(line)}
                    disabled={busy}
                  >
                    {t("addToAct")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveBoq} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("boqItemCode")}
              preset="code"
              value={boqCode}
              onChange={(e) => setBoqCode(e.target.value)}
              required
            />
            <Field
              label={t("boqQty")}
              preset="count"
              value={boqQty}
              onChange={(e) => setBoqQty(e.target.value)}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t("boqDescription")}
              preset="shortText"
              value={boqDesc}
              onChange={(e) => setBoqDesc(e.target.value)}
            />
            <Field
              label={t("boqAmount")}
              preset="amount"
              value={boqAmount}
              onChange={(e) => setBoqAmount(e.target.value)}
            />
          </FieldRow>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !boqCode.trim()}>
            {t("saveBoq")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("actsTitle")}</h3>
        <div className="flex flex-wrap gap-2">
          <Field
            label={t("periodKey")}
            preset="code"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createAct()} disabled={busy}>
            {t("createAct")}
          </button>
        </div>
        {acts.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("actsEmpty")}</p>
        ) : (
          <CatalogField
            kind="CLOSED_MEDIUM"
            label={t("selectAct")}
            value={selectedActId}
            onChange={(v) => selectAct(String(v))}
            options={acts.map((a) => ({
              value: a.id,
              label: `${actStatusLabel(a.status)} · ${Number(a.amountNet).toFixed(2)} AZN${a.periodKey ? ` · ${a.periodKey}` : ""}`,
            }))}
          />
        )}

        {selectedAct ? (
          <div className="space-y-3">
            <p className="text-[12px] text-[#7F8C8D]">
              {t("actStatus", {
                status: actStatusLabel(selectedAct.status),
                amount: Number(selectedAct.amountNet).toFixed(2),
              })}
            </p>
            {actApprovedLocked ? (
              <div className="space-y-2 rounded border border-[#D5D8DC] bg-[#F8F9F9] p-2 text-[12px] text-[#5D6D7E]">
                <p>{t("actApprovedLocked")}</p>
                <p>{t("actJournalVerifyHint", { actId: selectedAct.id })}</p>
                {selectedAct.financeContractId ? (
                  <p>
                    {t("actFinanceContractHint", {
                      contractId: selectedAct.financeContractId,
                    })}
                  </p>
                ) : null}
                <p>{t("payAppBridgeHint")}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field
                    label={t("financePayAppId")}
                    preset="code"
                    value={payAppIdDraft}
                    onChange={(e) => setPayAppIdDraft(e.target.value)}
                    hint={t("financePayAppHint")}
                  />
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void savePayAppRef()}
                  >
                    {t("saveFinancePayApp")}
                  </button>
                </div>
              </div>
            ) : null}
            {draftLines.length === 0 ? (
              !actApprovedLocked ? (
                <p className="rounded border border-[#D5D8DC] bg-[#F8F9F9] p-3 text-[12px] text-[#5D6D7E]">
                  {t("actLinesEmpty")}
                </p>
              ) : null
            ) : (
              <>
                <p className="text-[12px] text-[#1A5276]">
                  {t("actLinesSummary", {
                    count: draftLines.length,
                    total: draftLinesTotal.toFixed(2),
                  })}
                </p>
                {draftLines.map((line, index) => (
                  <div key={`${line.itemCode}-${index}`} className="grid gap-2 sm:grid-cols-4">
                    <Field
                      label={t("lineCode")}
                      preset="code"
                      value={line.itemCode}
                      onChange={(e) => updateDraftLine(index, { itemCode: e.target.value })}
                      disabled={!actEditable}
                    />
                    <Field
                      label={t("lineDescription")}
                      preset="shortText"
                      value={line.description}
                      onChange={(e) => updateDraftLine(index, { description: e.target.value })}
                      disabled={!actEditable}
                    />
                    <Field
                      label={t("lineQty")}
                      preset="count"
                      value={String(line.qty)}
                      onChange={(e) => updateDraftLine(index, { qty: Number(e.target.value) || 0 })}
                      disabled={!actEditable}
                    />
                    <div className="flex items-end gap-2">
                      <Field
                        label={t("lineAmount")}
                        preset="amount"
                        value={String(line.amountNet)}
                        onChange={(e) =>
                          updateDraftLine(index, { amountNet: Number(e.target.value) || 0 })
                        }
                        disabled={!actEditable}
                      />
                      {actEditable ? (
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          onClick={() => removeDraftLine(index)}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {actEditable ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void saveLines()}
                  disabled={busy || draftLines.length === 0}
                >
                  {t("saveLines")}
                </button>
              ) : null}
              {actEditable ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void approveAct()}
                  disabled={busy || draftLines.length === 0 || draftLinesTotal <= 0}
                >
                  {t("approveAct")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("dailyTitle")}</h3>
        {logs.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("dailyEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {logs.slice(0, 5).map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {String(log.logDate).slice(0, 10)}
                  {log.weather ? ` · ${log.weather}` : ""}
                  {log.crewCount != null ? ` · ${log.crewCount}` : ""}
                  {log.status ? ` · ${log.status}` : ""}
                </span>
                {log.status !== "SUBMITTED" ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void submitLog(log.id)}
                  >
                    {t("submitLog")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveDailyLog} className={FORM_STACK_CLASS}>
          <DatePicker label={t("logDate")} value={logDate} onChange={setLogDate} placeholder="dd.mm.yyyy" required />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("weather")}
            value={weather}
            onChange={(v) => setWeather(String(v))}
            options={[
              { value: "", label: "—" },
              { value: "CLEAR", label: t("weatherClear") },
              { value: "RAIN", label: t("weatherRain") },
              { value: "CLOUD", label: t("weatherCloud") },
              { value: "WIND", label: t("weatherWind") },
            ]}
            emptyLabel={null}
          />
          <Field
            label={t("crewCount")}
            preset="count"
            value={crewCount}
            onChange={(e) => setCrewCount(e.target.value)}
          />
          {parties.length > 0 ? (
            <FieldRow cols={2}>
              <CatalogField
                kind="CLOSED_MEDIUM"
                label={t("crewByParty")}
                value={crewPartyId}
                onChange={(v) => setCrewPartyId(String(v))}
                options={[
                  { value: "", label: "—" },
                  ...parties.map((p) => ({
                    value: p.id,
                    label: `${p.role} · ${p.displayName}`,
                  })),
                ]}
                emptyLabel={null}
              />
              <Field
                label={t("crewByPartyCount")}
                preset="count"
                value={crewPartyCount}
                onChange={(e) => setCrewPartyCount(e.target.value)}
              />
            </FieldRow>
          ) : null}
          <Field
            label={t("equipmentNotes")}
            preset="shortText"
            value={equipmentNotes}
            onChange={(e) => setEquipmentNotes(e.target.value)}
          />
          <Field
            label={t("photoUrl")}
            preset="shortText"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
          <FieldTextarea
            label={t("notes")}
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            rows={2}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !logDate}>
            {t("saveLog")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("punchTitle")}</h3>
        {punches.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("punchEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {punches.map((item) => (
              <li key={item.id} className="flex flex-wrap items-end justify-between gap-2 border-b py-1">
                <div className="min-w-0 flex-1 space-y-1">
                  <span>
                    {item.location} — {item.description}
                  </span>
                  {bimEnabled && (item.ifcElementId || item.externalViewerUrl) && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {item.ifcElementId ? (
                        <span className="rounded border px-1.5 py-0.5 text-[#7F8C8D]">
                          {t("bimIfc")}: {item.ifcElementId}
                        </span>
                      ) : null}
                      {item.externalViewerUrl ? (
                        <a
                          href={item.externalViewerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-[#2980B9]/40 px-1.5 py-0.5 text-[#2980B9]"
                        >
                          {t("bimViewer")}
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("punchStatus")}
                  value={item.status}
                  onChange={(v) => {
                    const next = String(v);
                    if (next === item.status) return;
                    void updatePunchStatus(item.id, next);
                  }}
                  options={punchStatusOptions(item.status)}
                  hideLabel
                />
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={savePunch} className={FORM_STACK_CLASS}>
          <Field
            label={t("punchLocation")}
            preset="shortText"
            value={punchLocation}
            onChange={(e) => setPunchLocation(e.target.value)}
            required
          />
          <Field
            label={t("punchDescription")}
            preset="shortText"
            value={punchDesc}
            onChange={(e) => setPunchDesc(e.target.value)}
            required
          />
          <Field
            label={t("punchAssignee")}
            preset="shortText"
            value={punchAssignee}
            onChange={(e) => setPunchAssignee(e.target.value)}
          />
          <CatalogField
            kind="CLOSED_MEDIUM"
            label={t("punchSheet")}
            value={punchSheetId}
            onChange={(v) => setPunchSheetId(String(v))}
            options={[
              { value: "", label: "—" },
              ...sheets.map((s) => ({
                value: s.id,
                label: `${s.drawingCode} rev ${s.revision}`,
              })),
            ]}
            emptyLabel={null}
          />
          <FieldRow cols={2}>
            <Field
              label={t("punchPinX")}
              preset="count"
              value={punchPinX}
              onChange={(e) => setPunchPinX(e.target.value)}
            />
            <Field
              label={t("punchPinY")}
              preset="count"
              value={punchPinY}
              onChange={(e) => setPunchPinY(e.target.value)}
            />
          </FieldRow>
          {bimEnabled ? (
            <FieldRow cols={2}>
              <Field
                label={t("bimIfc")}
                preset="shortText"
                value={punchIfc}
                onChange={(e) => setPunchIfc(e.target.value)}
              />
              <Field
                label={t("bimViewerUrl")}
                preset="shortText"
                value={punchViewerUrl}
                onChange={(e) => setPunchViewerUrl(e.target.value)}
              />
            </FieldRow>
          ) : null}
          <button
            type="submit"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !punchLocation.trim() || !punchDesc.trim()}
          >
            {t("savePunch")}
          </button>
        </form>
      </section>
    </div>
  );
}
