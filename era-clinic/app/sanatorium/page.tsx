"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

type Episode = {
  id: string;
  reservationId: string | null;
  hotelStayId: string | null;
  organizationId: string;
  status: string;
  openedAt: string;
  patientRef: { id: string; fullName: string; refCode: string } | null;
  complaints: { text: string; recordedAt: string }[];
  diagnoses: {
    icdCodeText: string | null;
    icdCode?: { code: string } | null;
    description: string;
  }[];
  labOrders: { id: string; testCode: string; status: string }[];
};

export default function SanatoriumPage() {
  const t = useTranslations("sanatorium");
  const tNav = useTranslations("nav");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [complaint, setComplaint] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [testCode, setTestCode] = useState("CBC");
  const [msg, setMsg] = useState("");
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/sanatorium/episodes");
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setEpisodes(list);
    if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = episodes.find((e) => e.id === selectedId);

  async function postAction(action: string, body: unknown) {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch(`/api/sanatorium/episodes/${selectedId}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t("saved") : (data.error ?? t("failed")));
    if (res.ok) {
      if (action === "complaint") {
        setComplaint("");
        setComplaintModalOpen(false);
      }
      if (action === "diagnosis") {
        setIcdCode("");
        setDiagnosis("");
        setDiagnosisModalOpen(false);
      }
      if (action === "lab") setLabModalOpen(false);
      await load();
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            {tNav("home")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {msg && <p className="text-[13px] text-emerald-700">{msg}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("inHouseList")}</h2>
            <ul className="space-y-2 text-[13px]">
              {episodes.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`w-full rounded border px-3 py-2 text-left ${
                      e.id === selectedId ? "border-sky-500 bg-sky-50" : "border-[#ECF0F1]"
                    }`}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <div className="font-medium">{e.patientRef?.fullName ?? t("guest")}</div>
                    <div className="text-[#7F8C8D]">
                      {t("stay")} {e.reservationId?.slice(0, 8) ?? "—"} · {e.status}
                    </div>
                  </button>
                </li>
              ))}
              {episodes.length === 0 && (
                <li className="text-[#7F8C8D]">{t("noEpisodes")}</li>
              )}
            </ul>
          </div>
          {selected && (
            <div className="space-y-4 text-[13px]">
              <div>
                <strong>{selected.patientRef?.fullName}</strong> ({selected.patientRef?.refCode})
                {selected.patientRef?.id ? (
                  <Link
                    href={`/patients/${selected.patientRef.id}`}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    Body map
                  </Link>
                ) : null}
              </div>
              <div>
                <h3 className="font-semibold">{t("complaints")}</h3>
                <ul className="list-disc pl-5">
                  {selected.complaints.map((c, i) => (
                    <li key={i}>{c.text}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                  onClick={() => setComplaintModalOpen(true)}
                >
                  {t("add")}
                </button>
              </div>
              <div>
                <h3 className="font-semibold">{t("diagnoses")}</h3>
                <ul className="list-disc pl-5">
                  {selected.diagnoses.map((d, i) => (
                    <li key={i}>
                      {(d.icdCode?.code ?? d.icdCodeText)
                        ? `${d.icdCode?.code ?? d.icdCodeText}: `
                        : ""}
                      {d.description}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                  onClick={() => setDiagnosisModalOpen(true)}
                >
                  {t("addDiagnosis")}
                </button>
              </div>
              <div>
                <h3 className="font-semibold">{t("labOrders")}</h3>
                <ul>
                  {selected.labOrders.map((o) => (
                    <li key={o.id}>
                      {o.testCode} — {o.status}{" "}
                      <Link href={`/lab-orders/${o.id}`} className="text-sky-600 underline">
                        {t("workflow")}
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                  onClick={() => setLabModalOpen(true)}
                >
                  {t("orderLab")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ModalShell
        open={complaintModalOpen}
        title={t("newComplaint")}
        onClose={() => setComplaintModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setComplaintModalOpen(false)}
            onSubmit={() => void postAction("complaint", { text: complaint })}
            busy={busy}
            submitLabel={t("add")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("newComplaint")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={diagnosisModalOpen}
        title={t("addDiagnosis")}
        onClose={() => setDiagnosisModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setDiagnosisModalOpen(false)}
            onSubmit={() => void postAction("diagnosis", { icdCode, description: diagnosis })}
            busy={busy}
            submitLabel={t("addDiagnosis")}
          />
        }
      >
        <div className={`${FORM_STACK_CLASS} grid grid-cols-2 gap-3`}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>ICD</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={icdCode}
              onChange={(e) => setIcdCode(e.target.value)}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("description")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={labModalOpen}
        title={t("orderLab")}
        onClose={() => setLabModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setLabModalOpen(false)}
            onSubmit={() => void postAction("lab", { testCode })}
            busy={busy}
            submitLabel={t("orderLab")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("orderLab")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
