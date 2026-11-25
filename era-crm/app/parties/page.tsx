"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Company = {
  id: string;
  name: string;
  taxId?: string | null;
  contacts?: Contact[];
};
type Contact = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  company?: { name: string } | null;
};

export default function PartiesPage() {
  const t = useTranslations("parties");
  const tc = useTranslations("common");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCompanyId, setContactCompanyId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [cRes, pRes] = await Promise.all([
      fetch("/api/companies"),
      fetch("/api/contacts"),
    ]);
    const cJson = await cRes.json();
    const pJson = await pRes.json();
    if (!cRes.ok || !pRes.ok) {
      setError(cJson.error ?? pJson.error ?? "Failed");
      return;
    }
    setCompanies(cJson.items ?? []);
    setContacts(pJson.items ?? []);
    setError("");
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCompany() {
    setBusy(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName, taxId: companyTaxId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setCompanyName("");
      setCompanyTaxId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createContact() {
    setBusy(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: contactName,
          phone: contactPhone || undefined,
          email: contactEmail || undefined,
          companyId: contactCompanyId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setContactCompanyId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("companies")}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field
            label={t("companyName")}
            preset="shortText"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <Field
            label={t("taxId")}
            preset="shortText"
            value={companyTaxId}
            onChange={(e) => setCompanyTaxId(e.target.value)}
          />
          <div className="flex items-end">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !companyName.trim()}
              onClick={() => void createCompany()}
            >
              {tc("save")}
            </button>
          </div>
        </div>
        <ul className="space-y-1 text-sm">
          {companies.map((c) => (
            <li key={c.id}>
              {c.name}
              {c.taxId ? ` · ${c.taxId}` : ""}
              <span className="ml-2 font-mono text-[11px] text-[#7F8C8D]">{c.id.slice(0, 8)}</span>
            </li>
          ))}
          {companies.length === 0 ? <li className="text-[#7F8C8D]">{t("emptyCompanies")}</li> : null}
        </ul>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("contacts")}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label={t("fullName")}
            preset="shortText"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Field
            label={t("phone")}
            preset="shortText"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Field
            label={t("email")}
            preset="shortText"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Field
            label={t("companyId")}
            preset="shortText"
            value={contactCompanyId}
            onChange={(e) => setContactCompanyId(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !contactName.trim()}
          onClick={() => void createContact()}
        >
          {tc("save")}
        </button>
        <ul className="space-y-1 text-sm">
          {contacts.map((c) => (
            <li key={c.id}>
              {c.fullName}
              {c.company?.name ? ` · ${c.company.name}` : ""}
              {c.phone ? ` · ${c.phone}` : ""}
            </li>
          ))}
          {contacts.length === 0 ? <li className="text-[#7F8C8D]">{t("emptyContacts")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
