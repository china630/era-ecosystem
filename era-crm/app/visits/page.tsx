"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
} from "@era/satellite-kit/ui";

const visitFormId = "log-visit-form";
import { PageHeader } from "@era/satellite-kit/ui";

type LeadOption = { id: string; title: string; contactRef: string };

type Visit = {
  id: string;
  notes?: string | null;
  addressLabel?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  visitedAt: string;
  lead: { id: string; title: string; contactRef: string };
};

export default function VisitsPage() {
  const t = useTranslations("visits");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadId, setLeadId] = useState("");
  const [notes, setNotes] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadVisits() {
    setLoading(true);
    try {
      const res = await fetch("/api/visits");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load visits");
      setVisits(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVisits();
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .catch(() => setLeads([]));
  }, []);

  async function logVisit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!leadId) {
      setMessage(t("selectLeadError"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          notes: notes || undefined,
          addressLabel: addressLabel || undefined,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to log visit");
      setNotes("");
      setMessage(t("logged", { title: data.lead?.title ?? leadId }));
      setModalOpen(false);
      await loadVisits();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              {t("logVisit")}
            </button>
            <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
              {t("pipeline")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {message && <p className="text-[13px]">{message}</p>}

        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-[#34495E]">{t("recent")}</h2>
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
          ) : visits.length === 0 ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((visit) => (
                <li
                  key={visit.id}
                  className="rounded border p-3 text-[13px]"
                >
                  <div className="font-medium">{visit.lead.title}</div>
                  <div className="text-[#7F8C8D]">
                    {visit.lead.contactRef} ·{" "}
                    {new Date(visit.visitedAt).toLocaleString()}
                  </div>
                  {visit.addressLabel && (
                    <p className="text-[#7F8C8D]">{visit.addressLabel}</p>
                  )}
                  {visit.latitude != null && visit.longitude != null && (
                    <p className="text-[#7F8C8D]">
                      {Number(visit.latitude).toFixed(4)},{" "}
                      {Number(visit.longitude).toFixed(4)}
                    </p>
                  )}
                  {visit.notes && <p className="mt-1">{visit.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ModalShell
        open={modalOpen}
        title={t("logVisit")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={visitFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t("logVisit")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={visitFormId} onSubmit={logVisit} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("lead")}</label>
            <select
              className={MODAL_INPUT_CLASS}
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              required
            >
              <option value="">{t("selectLead")}</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.title} ({lead.contactRef})
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("address")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={addressLabel}
              onChange={(e) => setAddressLabel(e.target.value)}
              placeholder="Baku, Nizami st. 12"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("latitude")}</label>
              <input
                className={MODAL_INPUT_CLASS}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="40.4093"
              />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("longitude")}</label>
              <input
                className={MODAL_INPUT_CLASS}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="49.8671"
              />
            </div>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("notes")}</label>
            <textarea
              className={MODAL_INPUT_CLASS}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Site visit notes…"
            />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
