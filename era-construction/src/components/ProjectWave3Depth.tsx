"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiJson } from "@/lib/client-api";

type Party = { id: string; role: string; displayName: string; financeCounterpartyId: string | null };
type Rfi = {
  id: string;
  subject: string;
  question: string;
  status: string;
  answer: string | null;
  assignee: string | null;
  ifcElementId?: string | null;
  externalViewerUrl?: string | null;
};
type Submittal = { id: string; title: string; status: string; specSection: string | null };
type Inspection = { id: string; title: string; status: string };
type ChangeReq = {
  id: string;
  title: string;
  status: string;
  financeContractId: string | null;
  impactCost: boolean;
};
type Sheet = {
  id: string;
  drawingCode: string;
  revision: string;
  sheetNumber: string | null;
  status: string;
  fileName: string | null;
};

const PARTY_ROLES = [
  { value: "GC", label: "GC" },
  { value: "SUB", label: "SUB" },
  { value: "OWNER", label: "OWNER" },
  { value: "INSPECTOR", label: "INSPECTOR" },
];

export function ProjectWave3Depth({ projectId }: { projectId: string }) {
  const t = useTranslations("projectsDetail.wave3");
  const tc = useTranslations("common");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [parties, setParties] = useState<Party[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [partyRole, setPartyRole] = useState("SUB");
  const [partyName, setPartyName] = useState("");
  const [partyCp, setPartyCp] = useState("");

  const [rfis, setRfis] = useState<Rfi[]>([]);
  const [rfiSubject, setRfiSubject] = useState("");
  const [rfiQuestion, setRfiQuestion] = useState("");
  const [rfiDueDate, setRfiDueDate] = useState("");
  const [rfiIfc, setRfiIfc] = useState("");
  const [rfiViewerUrl, setRfiViewerUrl] = useState("");
  const [bimEnabled, setBimEnabled] = useState(true);
  const [rfiAnswer, setRfiAnswer] = useState<Record<string, string>>({});

  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [subTitle, setSubTitle] = useState("");
  const [subSpec, setSubSpec] = useState("");

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspTitle, setInspTitle] = useState("");

  const [changes, setChanges] = useState<ChangeReq[]>([]);
  const [crTitle, setCrTitle] = useState("");
  const [crContract, setCrContract] = useState("");
  const [crRfiId, setCrRfiId] = useState("");

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [drawingCode, setDrawingCode] = useState("");
  const [revision, setRevision] = useState("A");
  const [sheetNumber, setSheetNumber] = useState("");
  const [fileName, setFileName] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    const q = roleFilter ? `?role=${encodeURIComponent(roleFilter)}` : "";
    const [p, r, s, i, c, d] = await Promise.all([
      fetch(`/api/projects/${projectId}/parties${q}`),
      fetch(`/api/projects/${projectId}/rfis`),
      fetch(`/api/projects/${projectId}/submittals`),
      fetch(`/api/projects/${projectId}/inspections`),
      fetch(`/api/projects/${projectId}/change-requests`),
      fetch(`/api/cde/documents?projectId=${encodeURIComponent(projectId)}`),
    ]);
    if (p.ok) setParties(await p.json());
    if (r.ok) setRfis(await r.json());
    if (s.ok) setSubmittals(await s.json());
    if (i.ok) setInspections(await i.json());
    if (c.ok) setChanges(await c.json());
    if (d.ok) {
      const data = await d.json();
      setSheets(Array.isArray(data.documents) ? data.documents : []);
    }
  }, [projectId, roleFilter]);

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

  const rfiOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...rfis.map((r) => ({ value: r.id, label: r.subject })),
    ],
    [rfis],
  );

  async function postJson(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setMessage("");
    const res = await apiJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || tc("error"));
      return false;
    }
    await load();
    return true;
  }

  return (
    <div className="space-y-6 border-t pt-4">
      <div>
        <h2 className="text-[13px] font-semibold">{t("title")}</h2>
        <p className="mt-1 text-[12px] text-[#7F8C8D]">{t("subtitle")}</p>
        {message ? <p className="mt-2 text-[13px]">{message}</p> : null}
      </div>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("partiesTitle")}</h3>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("roleFilter")}
          value={roleFilter}
          onChange={(v) => setRoleFilter(String(v))}
          options={[{ value: "", label: tc("all") }, ...PARTY_ROLES]}
          emptyLabel={null}
        />
        <ul className="space-y-1 text-[13px]">
          {parties.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("partiesEmpty")}</li>
          ) : (
            parties.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-b py-1">
                <span>
                  {p.role} — {p.displayName}
                </span>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() =>
                    void postJson(`/api/projects/${projectId}/parties?partyId=${p.id}`, {}, "DELETE").then(
                      (ok) => ok && setMessage(t("partyRemoved")),
                    )
                  }
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
        <form
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void postJson(`/api/projects/${projectId}/parties`, {
              role: partyRole,
              displayName: partyName.trim(),
              financeCounterpartyId: partyCp.trim() || null,
            }).then((ok) => {
              if (ok) {
                setPartyName("");
                setPartyCp("");
                setMessage(t("partySaved"));
              }
            });
          }}
        >
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("partyRole")}
            value={partyRole}
            onChange={(v) => setPartyRole(String(v))}
            options={PARTY_ROLES}
          />
          <Field
            label={t("partyName")}
            preset="shortText"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            required
          />
          <Field
            label={t("financeCounterpartyId")}
            preset="code"
            value={partyCp}
            onChange={(e) => setPartyCp(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !partyName.trim()}>
            {t("saveParty")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("sheetsTitle")}</h3>
        <ul className="space-y-1 text-[13px]">
          {sheets.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("sheetsEmpty")}</li>
          ) : (
            sheets.map((s) => (
              <li key={s.id}>
                {s.drawingCode} rev {s.revision}
                {s.sheetNumber ? ` · ${s.sheetNumber}` : ""} — {s.status}
              </li>
            ))
          )}
        </ul>
        <form
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void postJson("/api/cde/documents", {
              projectId,
              drawingCode: drawingCode.trim(),
              revision: revision.trim(),
              sheetNumber: sheetNumber.trim() || undefined,
              fileName: fileName.trim() || undefined,
              publish: true,
            }).then((ok) => {
              if (ok) {
                setDrawingCode("");
                setSheetNumber("");
                setFileName("");
                setMessage(t("sheetPublished"));
              }
            });
          }}
        >
          <FieldRow cols={2}>
            <Field
              label={t("drawingCode")}
              preset="code"
              value={drawingCode}
              onChange={(e) => setDrawingCode(e.target.value)}
              required
            />
            <Field
              label={t("revision")}
              preset="code"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t("sheetNumber")}
              preset="code"
              value={sheetNumber}
              onChange={(e) => setSheetNumber(e.target.value)}
            />
            <Field
              label={t("fileName")}
              preset="shortText"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </FieldRow>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !drawingCode.trim()}>
            {t("publishSheet")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("rfiTitle")}</h3>
        <ul className="space-y-2 text-[13px]">
          {rfis.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("rfiEmpty")}</li>
          ) : (
            rfis.map((r) => (
              <li key={r.id} className="rounded border p-2 space-y-2">
                <div>
                  {r.status} · {r.subject}
                </div>
                <p className="text-[#7F8C8D]">{r.question}</p>
                {bimEnabled && (r.ifcElementId || r.externalViewerUrl) && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {r.ifcElementId ? (
                      <span className="rounded border px-1.5 py-0.5 text-[#7F8C8D]">
                        {t("bimIfc")}: {r.ifcElementId}
                      </span>
                    ) : null}
                    {r.externalViewerUrl ? (
                      <a
                        href={r.externalViewerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-[#2980B9]/40 px-1.5 py-0.5 text-[#2980B9]"
                      >
                        {t("bimViewer")}
                      </a>
                    ) : null}
                  </div>
                )}
                {r.status === "OPEN" || r.status === "OVERDUE" ? (
                  <div className="flex flex-wrap gap-2">
                    <Field
                      label={t("answer")}
                      preset="shortText"
                      value={rfiAnswer[r.id] ?? ""}
                      onChange={(e) => setRfiAnswer((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy || !(rfiAnswer[r.id] ?? "").trim()}
                      onClick={() =>
                        void postJson(
                          `/api/projects/${projectId}/rfis`,
                          { rfiId: r.id, answer: (rfiAnswer[r.id] ?? "").trim() },
                          "PATCH",
                        ).then((ok) => ok && setMessage(t("rfiAnswered")))
                      }
                    >
                      {t("answerRfi")}
                    </button>
                  </div>
                ) : r.answer ? (
                  <p>{r.answer}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
        <form
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            const viewer = rfiViewerUrl.trim();
            if (bimEnabled && viewer && !/^https?:\/\//i.test(viewer)) {
              setMessage(t("bimViewerInvalid"));
              return;
            }
            void postJson(`/api/projects/${projectId}/rfis`, {
              subject: rfiSubject.trim(),
              question: rfiQuestion.trim(),
              dueDate: rfiDueDate || null,
              ifcElementId: bimEnabled ? rfiIfc.trim() || null : null,
              externalViewerUrl: bimEnabled ? viewer || null : null,
            }).then((ok) => {
              if (ok) {
                setRfiSubject("");
                setRfiQuestion("");
                setRfiDueDate("");
                setRfiIfc("");
                setRfiViewerUrl("");
                setMessage(t("rfiCreated"));
              }
            });
          }}
        >
          <Field
            label={t("rfiSubject")}
            preset="shortText"
            value={rfiSubject}
            onChange={(e) => setRfiSubject(e.target.value)}
            required
          />
          <FieldTextarea
            label={t("rfiQuestion")}
            value={rfiQuestion}
            onChange={(e) => setRfiQuestion(e.target.value)}
            rows={2}
            required
          />
          <DatePicker
            label={t("rfiDueDate")}
            value={rfiDueDate}
            onChange={setRfiDueDate}
            placeholder="dd.mm.yyyy"
          />
          {bimEnabled ? (
            <FieldRow cols={2}>
              <Field
                label={t("bimIfc")}
                preset="shortText"
                value={rfiIfc}
                onChange={(e) => setRfiIfc(e.target.value)}
              />
              <Field
                label={t("bimViewerUrl")}
                preset="shortText"
                value={rfiViewerUrl}
                onChange={(e) => setRfiViewerUrl(e.target.value)}
              />
            </FieldRow>
          ) : null}
          <button
            type="submit"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !rfiSubject.trim() || !rfiQuestion.trim()}
          >
            {t("createRfi")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("submittalTitle")}</h3>
        <ul className="space-y-2 text-[13px]">
          {submittals.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("submittalEmpty")}</li>
          ) : (
            submittals.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1">
                <span>
                  {s.status} · {s.title}
                  {s.specSection ? ` (${s.specSection})` : ""}
                </span>
                <div className="flex gap-1">
                  {s.status === "DRAFT" ? (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() =>
                        void postJson(
                          `/api/projects/${projectId}/submittals`,
                          { submittalId: s.id, status: "IN_REVIEW" },
                          "PATCH",
                        )
                      }
                    >
                      {t("submitForReview")}
                    </button>
                  ) : null}
                  {s.status === "IN_REVIEW" ? (
                    <>
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() =>
                          void postJson(
                            `/api/projects/${projectId}/submittals`,
                            { submittalId: s.id, status: "APPROVED" },
                            "PATCH",
                          )
                        }
                      >
                        {t("approve")}
                      </button>
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() =>
                          void postJson(
                            `/api/projects/${projectId}/submittals`,
                            { submittalId: s.id, status: "REJECTED" },
                            "PATCH",
                          )
                        }
                      >
                        {t("reject")}
                      </button>
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() =>
                          void postJson(
                            `/api/projects/${projectId}/submittals`,
                            { submittalId: s.id, status: "REVISE" },
                            "PATCH",
                          )
                        }
                      >
                        {t("revise")}
                      </button>
                    </>
                  ) : null}
                  {s.status === "REVISE" ? (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() =>
                        void postJson(
                          `/api/projects/${projectId}/submittals`,
                          { submittalId: s.id, status: "IN_REVIEW" },
                          "PATCH",
                        )
                      }
                    >
                      {t("submitForReview")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
        <form
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void postJson(`/api/projects/${projectId}/submittals`, {
              title: subTitle.trim(),
              specSection: subSpec.trim() || undefined,
            }).then((ok) => {
              if (ok) {
                setSubTitle("");
                setSubSpec("");
                setMessage(t("submittalCreated"));
              }
            });
          }}
        >
          <Field
            label={t("submittalTitleField")}
            preset="shortText"
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            required
          />
          <Field
            label={t("specSection")}
            preset="code"
            value={subSpec}
            onChange={(e) => setSubSpec(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !subTitle.trim()}>
            {t("createSubmittal")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("inspectionTitle")}</h3>
        <ul className="space-y-2 text-[13px]">
          {inspections.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("inspectionEmpty")}</li>
          ) : (
            inspections.map((insp) => (
              <li key={insp.id} className="flex justify-between gap-2 border-b py-1">
                <span>
                  {insp.status} · {insp.title}
                </span>
                {insp.status !== "FAILED" ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      void postJson(
                        `/api/projects/${projectId}/inspections`,
                        { inspectionId: insp.id, action: "FAIL" },
                        "PATCH",
                      ).then((ok) => ok && setMessage(t("inspectionFailed")))
                    }
                  >
                    {t("failInspection")}
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
        <form
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void postJson(`/api/projects/${projectId}/inspections`, {
              title: inspTitle.trim(),
            }).then((ok) => {
              if (ok) {
                setInspTitle("");
                setMessage(t("inspectionCreated"));
              }
            });
          }}
        >
          <Field
            label={t("inspectionTitleField")}
            preset="shortText"
            value={inspTitle}
            onChange={(e) => setInspTitle(e.target.value)}
            required
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !inspTitle.trim()}>
            {t("createInspection")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("changeTitle")}</h3>
        <p className="text-[12px] text-[#7F8C8D]">{t("changeHint")}</p>
        <ul className="space-y-2 text-[13px]">
          {changes.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("changeEmpty")}</li>
          ) : (
            changes.map((cr) => (
              <li key={cr.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1">
                <span>
                  {cr.status} · {cr.title}
                  {cr.financeContractId ? ` · Finance ${cr.financeContractId}` : ""}
                </span>
                <div className="flex gap-1">
                  {cr.status === "DRAFT" ? (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() =>
                        void postJson(
                          `/api/projects/${projectId}/change-requests`,
                          { changeRequestId: cr.id, status: "SUBMITTED" },
                          "PATCH",
                        )
                      }
                    >
                      {t("submitChange")}
                    </button>
                  ) : null}
                  {cr.status === "SUBMITTED" ? (
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() =>
                        void postJson(
                          `/api/projects/${projectId}/change-requests`,
                          { changeRequestId: cr.id, status: "APPROVED_OPS" },
                          "PATCH",
                        ).then((ok) => ok && setMessage(t("changeApprovedOps")))
                      }
                    >
                      {t("approveOps")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
        <form
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void postJson(`/api/projects/${projectId}/change-requests`, {
              title: crTitle.trim(),
              rfiId: crRfiId || null,
              financeContractId: crContract.trim() || null,
              impactCost: true,
            }).then((ok) => {
              if (ok) {
                setCrTitle("");
                setCrContract("");
                setCrRfiId("");
                setMessage(t("changeCreated"));
              }
            });
          }}
        >
          <Field
            label={t("changeTitleField")}
            preset="shortText"
            value={crTitle}
            onChange={(e) => setCrTitle(e.target.value)}
            required
          />
          <CatalogField
            kind="CLOSED_MEDIUM"
            label={t("linkRfi")}
            value={crRfiId}
            onChange={(v) => setCrRfiId(String(v))}
            options={rfiOptions}
            emptyLabel={null}
          />
          <Field
            label={t("financeContractId")}
            preset="code"
            value={crContract}
            onChange={(e) => setCrContract(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !crTitle.trim()}>
            {t("createChange")}
          </button>
        </form>
      </section>
    </div>
  );
}
