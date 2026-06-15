"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Patient = {
  id: string;
  refCode: string;
  fullName: string;
  phone?: string | null;
  globalPersonId?: string | null;
};

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export default function PatientsPage() {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    refCode: "",
    fullName: "",
    phone: "",
    finCode: "",
    passportNumber: "",
    issuingCountry: "AZ",
  });

  const load = useCallback(async () => {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/patients${params}`);
    const d = await res.json();
    setRows((d.data ?? d) as Patient[]);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function lookupMdm() {
    setMdmStatus(null);
    if (!form.finCode.trim()) {
      setMdmStatus(t("finRequired"));
      return;
    }
    const res = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fin: form.finCode.trim() }),
    });
    const data = await res.json();
    if (data.globalPersonId) {
      setMdmStatus(t("mdmLinked", { id: maskPersonId(data.globalPersonId) }));
      if (data.fullName && !form.fullName) {
        setForm((f) => ({ ...f, fullName: data.fullName }));
      }
    } else {
      setMdmStatus(t("mdmNotFound"));
    }
  }

  async function save() {
    setError(null);
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("saveFailed"));
      return;
    }
    setOpen(false);
    setForm({
      refCode: "",
      fullName: "",
      phone: "",
      finCode: "",
      passportNumber: "",
      issuingCountry: "AZ",
    });
    setMdmStatus(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
            {tc("add")}
          </button>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <input
          className={MODAL_INPUT_CLASS}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b text-[#7F8C8D]">
              <th className="p-2">{t("refCode")}</th>
              <th className="p-2">{t("name")}</th>
              <th className="p-2">{t("phone")}</th>
              <th className="p-2">{t("mdmBadge")}</th>
              <th className="p-2">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.refCode}</td>
                <td className="p-2">{p.fullName}</td>
                <td className="p-2">{p.phone ?? "—"}</td>
                <td className="p-2">
                  {p.globalPersonId ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs">
                      {maskPersonId(p.globalPersonId)}
                    </span>
                  ) : (
                    <span className="text-red-600">{t("mdmMissing")}</span>
                  )}
                </td>
                <td className="p-2">
                  <Link href={`/patients/${p.id}`} className="text-[#2980B9] hover:underline">
                    {t("openCard")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ModalShell open={open} title={t("createTitle")} onClose={() => setOpen(false)}>
        <div className="space-y-2">
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("refCode")}
            value={form.refCode}
            onChange={(e) => setForm({ ...form, refCode: e.target.value })}
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("name")}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className={`flex-1 ${MODAL_INPUT_CLASS}`}
              placeholder={t("finCode")}
              value={form.finCode}
              onChange={(e) => setForm({ ...form, finCode: e.target.value.toUpperCase() })}
            />
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void lookupMdm()}>
              {t("mdmLookup")}
            </button>
          </div>
          {mdmStatus ? <p className="text-xs text-[#7F8C8D]">{mdmStatus}</p> : null}
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("passportNumber")}
            value={form.passportNumber}
            onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("issuingCountry")}
            value={form.issuingCountry}
            onChange={(e) => setForm({ ...form, issuingCountry: e.target.value })}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </>
  );
}
