"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  FieldRow,
  FieldSelect,
  PRIMARY_BUTTON_CLASS,
  VoenLookupField,
  PageHeader,
  type CatalogOption,
} from "@era/satellite-kit/ui";

type Agent = {
  id: string;
  fullName: string;
  login: string;
  role: { code: string };
};

type Lead = {
  id: string;
  title: string;
  contactRef: string;
  stage: string;
  channel: string;
  partyKind?: string;
  taxId?: string | null;
  companyName?: string | null;
  prospectType?: string;
  activitySector?: string | null;
  ownerId?: string | null;
  owner?: { id: string; fullName: string; login: string } | null;
  estimatedAmount?: string | number | null;
  nextContactAt?: string | null;
};

type SessionUser = {
  id: string;
  fullName: string;
  role: { code: string };
};

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const ASSIGN_ROLES = new Set(["SALES_LEAD", "BUSINESS_OWNER"]);

const FALLBACK_CHANNEL: CatalogOption[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "visit", label: "Visit" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
];

const FALLBACK_SECTOR: CatalogOption[] = [
  { value: "Hospitality", label: "Hospitality" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Retail", label: "Retail" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Construction", label: "Construction" },
  { value: "Logistics", label: "Logistics" },
  { value: "Finance", label: "Finance" },
  { value: "Other", label: "Other" },
];

const FALLBACK_PROSPECT: CatalogOption[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "PARTNER", label: "Partner" },
  { value: "OTHER", label: "Other" },
];

function PipelineFallback() {
  const t = useTranslations("leads");
  return <p className="p-6 text-[13px]">{t("loadingPipeline")}</p>;
}

export default function LeadsPipelinePage() {
  return (
    <Suspense fallback={<PipelineFallback />}>
      <LeadsPipelineContent />
    </Suspense>
  );
}

function LeadsPipelineContent() {
  const t = useTranslations("leads");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);
  const [prospectFilter, setProspectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [prefillNotice, setPrefillNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formPartyKind, setFormPartyKind] = useState<"INDIVIDUAL" | "LEGAL_ENTITY">(
    "LEGAL_ENTITY",
  );
  const [formTaxId, setFormTaxId] = useState("");
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formProspectType, setFormProspectType] = useState<
    "CUSTOMER" | "PARTNER" | "OTHER"
  >("CUSTOMER");
  const [formSector, setFormSector] = useState("");
  const [formChannel, setFormChannel] = useState("phone");
  const [formAmount, setFormAmount] = useState("");
  const [formFin, setFormFin] = useState("");
  const [formGlobalPersonId, setFormGlobalPersonId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [channelOptions, setChannelOptions] = useState<CatalogOption[]>(FALLBACK_CHANNEL);
  const [sectorOptions, setSectorOptions] = useState<CatalogOption[]>(FALLBACK_SECTOR);
  const [prospectOptions, setProspectOptions] =
    useState<CatalogOption[]>(FALLBACK_PROSPECT);

  const canAssign = session ? ASSIGN_ROLES.has(session.role.code) : false;

  async function loadLeads(mine = myLeadsOnly, prospect = prospectFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mine) params.set("mine", "true");
      if (prospect) params.set("prospectType", prospect);
      const qs = params.toString();
      const res = await fetch(`/api/leads${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
      setLeads(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]));
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSession(data))
      .catch(() => setSession(null));

    async function loadLookups() {
      try {
        const kinds = ["CHANNEL", "ACTIVITY_SECTOR", "PROSPECT_TYPE"] as const;
        const results = await Promise.all(
          kinds.map(async (kind) => {
            const res = await fetch(`/api/lookups?kind=${kind}&activeOnly=1`);
            const data = await res.json();
            return Array.isArray(data)
              ? (data as { code: string; name: string }[]).map((r) => ({
                  value: r.code,
                  label: r.name || r.code,
                }))
              : [];
          }),
        );
        if (results[0]?.length) setChannelOptions(results[0]);
        if (results[1]?.length) setSectorOptions(results[1]);
        if (results[2]?.length) setProspectOptions(results[2]);
      } catch {
        /* keep fallbacks */
      }
    }
    void loadLookups();
  }, []);

  useEffect(() => {
    const channel = searchParams.get("channel");
    const contactRef = searchParams.get("contactRef");
    if (channel && contactRef) {
      setPrefillNotice(
        t("prefill", { channel: channel ?? "", contactRef: contactRef ?? "" }),
      );
      setFormPhone(contactRef);
      setShowCreate(true);
    }
  }, [searchParams, t]);

  useEffect(() => {
    void loadLeads(myLeadsOnly, prospectFilter);
  }, [myLeadsOnly, prospectFilter]);

  async function resolveFin() {
    if (!formFin.trim() || formPartyKind !== "INDIVIDUAL") return;
    const res = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fin: formFin.trim(),
        fullName: formTitle.trim() || undefined,
        phone: formPhone.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok && data.globalPersonId) {
      setFormGlobalPersonId(data.globalPersonId);
      setMessage(t("finLinked"));
    }
  }

  async function createLead() {
    setCreating(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        title: formTitle.trim() || formCompanyName.trim() || formPhone.trim(),
        partyKind: formPartyKind,
        prospectType: formProspectType,
        activitySector: formSector.trim() || undefined,
        contactPhone: formPhone.trim() || undefined,
        contactEmail: formEmail.trim() || undefined,
        contactRef: formPhone.trim() || formEmail.trim() || undefined,
        channel: formChannel || (formPhone.trim() ? "phone" : "other"),
        estimatedAmount: formAmount ? Number(formAmount) : undefined,
        globalPersonId: formGlobalPersonId ?? undefined,
      };
      if (formPartyKind === "LEGAL_ENTITY") {
        body.taxId = formTaxId.trim() || undefined;
        body.companyName = formCompanyName.trim() || undefined;
      }
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setMessage(t("leadCreated", { id: data.id.slice(0, 8) }));
      setShowCreate(false);
      await loadLeads(myLeadsOnly, prospectFilter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function convertLead(id: string) {
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Convert failed");
      setMessage(t("converted", { id: id.slice(0, 8) }));
      await loadLeads(myLeadsOnly, prospectFilter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  async function scheduleFollowUp(leadId: string, nextContactAt: string) {
    if (!nextContactAt) return;
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${leadId}/follow-up`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextContactAt: new Date(nextContactAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Follow-up failed");
      setMessage(t("followUpScheduled", { id: leadId.slice(0, 8) }));
      await loadLeads(myLeadsOnly, prospectFilter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  async function scheduleFollowUpBusinessDays(leadId: string, days: number) {
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${leadId}/follow-up`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offsetBusinessDays: days,
          fromDate: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Follow-up failed");
      setMessage(t("followUpScheduled", { id: leadId.slice(0, 8) }));
      await loadLeads(myLeadsOnly, prospectFilter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  async function assignLead(id: string, ownerId: string) {
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: ownerId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assign failed");
      await loadLeads(myLeadsOnly, prospectFilter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  const grouped = STAGES.map((stage) => ({
    stage,
    items: leads.filter((l) => l.stage === stage),
  }));

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setShowCreate(true)}
            >
              {t("createLead")}
            </button>
            <Link href="/visits" className={PRIMARY_BUTTON_CLASS}>
              {t("visits")}
            </Link>
            <Link href="/inbox" className={PRIMARY_BUTTON_CLASS}>
              {t("inbox")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={myLeadsOnly}
              onChange={(e) => setMyLeadsOnly(e.target.checked)}
            />
            {t("myLeads")}
            {session && (
              <span className="text-[#7F8C8D]">({session.fullName})</span>
            )}
          </label>
          <label className="flex items-center gap-2">
            {t("prospectFilter")}
            <select
              className="rounded border px-2 py-1"
              value={prospectFilter}
              onChange={(e) => setProspectFilter(e.target.value)}
            >
              <option value="">{tc("all")}</option>
              <option value="CUSTOMER">{t("prospectCustomer")}</option>
              <option value="PARTNER">{t("prospectPartner")}</option>
              <option value="OTHER">{t("prospectOther")}</option>
            </select>
          </label>
        </div>

        {loading && <p className="text-[13px]">{tc("loading")}</p>}
        {message && <p className="text-[13px]">{message}</p>}
        {prefillNotice && (
          <p className="text-[13px] text-[#2980B9]">{prefillNotice}</p>
        )}

        {showCreate && (
          <div className="rounded border border-[#D5DBDB] bg-[#FAFBFC] p-4 space-y-3 max-w-lg">
            <h3 className="text-[14px] font-semibold">{t("createLead")}</h3>
            <FieldSelect
              label={t("partyKind")}
              preset="selectWide"
              value={formPartyKind}
              onChange={(e) =>
                setFormPartyKind(e.target.value as "INDIVIDUAL" | "LEGAL_ENTITY")
              }
            >
              <option value="LEGAL_ENTITY">{t("legalEntity")}</option>
              <option value="INDIVIDUAL">{t("individual")}</option>
            </FieldSelect>
            <Field
              label={tc("name")}
              preset="shortText"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
            {formPartyKind === "LEGAL_ENTITY" && (
              <>
                <VoenLookupField
                  value={formTaxId}
                  onChange={setFormTaxId}
                  onResolved={(r) => {
                    if (r.found && r.name) setFormCompanyName(r.name);
                  }}
                  labels={{
                    voen: t("companyVoen"),
                    check: tc("check"),
                    found: t("companyFound"),
                    notFound: t("companyNotFound"),
                    invalid: t("companyVoenInvalid"),
                  }}
                />
                <Field
                  label={t("companyName")}
                  preset="shortText"
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                />
              </>
            )}
            <FieldRow cols={2}>
              <Field
                label={t("contactPhone")}
                preset="phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
              <Field
                label={t("contactEmail")}
                preset="shortText"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </FieldRow>
            {formPartyKind === "INDIVIDUAL" && (
              <div className="flex gap-2 items-end">
                <Field
                  label="FIN"
                  preset="fin"
                  className="flex-1"
                  value={formFin}
                  onChange={(e) => setFormFin(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-[12px]"
                  onClick={() => void resolveFin()}
                >
                  {t("finLookup")}
                </button>
              </div>
            )}
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("channel")}
              value={formChannel}
              onChange={(v) => setFormChannel(String(v))}
              options={channelOptions}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("prospectType")}
              value={formProspectType}
              onChange={(v) =>
                setFormProspectType(String(v) as "CUSTOMER" | "PARTNER" | "OTHER")
              }
              options={prospectOptions}
            />
            <FieldRow cols={2}>
              <CatalogField
                kind="CLOSED_MEDIUM"
                label={t("activitySector")}
                value={formSector}
                onChange={(v) => setFormSector(String(v))}
                options={sectorOptions}
              />
              <Field
                label={t("estimatedAmount")}
                preset="amount"
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </FieldRow>
            <div className="flex gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={creating}
                onClick={() => void createLead()}
              >
                {creating ? tc("loading") : tc("save")}
              </button>
              <button
                type="button"
                className="rounded border px-3 py-1 text-[13px]"
                onClick={() => setShowCreate(false)}
              >
                {tc("cancel")}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {grouped.map(({ stage, items }) => (
            <div key={stage} className="rounded border p-3">
              <h3 className="text-[12px] font-semibold uppercase text-[#7F8C8D]">
                {stage} ({items.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {items.map((lead) => (
                  <li key={lead.id} className="rounded bg-[#F8F9FA] p-2 text-[12px]">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-[#2980B9] hover:underline"
                    >
                      {lead.title}
                    </Link>
                    <div className="text-[#7F8C8D]">{lead.contactRef}</div>
                    {lead.taxId && (
                      <div className="text-[11px] text-[#7F8C8D]">
                        VÖEN: {lead.taxId}
                      </div>
                    )}
                    {lead.prospectType === "PARTNER" && (
                      <span className="text-[10px] text-[#E67E22]">{t("prospectPartner")}</span>
                    )}
                    {lead.activitySector && (
                      <div className="text-[11px]">{lead.activitySector}</div>
                    )}
                    {lead.owner && (
                      <div className="text-[11px] text-[#7F8C8D]">
                        {t("owner")}: {lead.owner.fullName}
                      </div>
                    )}
                    {canAssign && (
                      <label className="mt-1 block text-[11px]">
                        {t("assign")}
                        <select
                          className="mt-0.5 block w-full rounded border px-1 py-0.5"
                          value={lead.ownerId ?? ""}
                          onChange={(e) => assignLead(lead.id, e.target.value)}
                        >
                          <option value="">{t("unassigned")}</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.fullName}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {lead.nextContactAt && (
                      <div className="text-[11px] text-[#E67E22]">
                        {t("next")}: {new Date(lead.nextContactAt).toLocaleString()}
                      </div>
                    )}
                    {lead.stage !== "WON" && lead.stage !== "LOST" && (
                      <>
                        <label className="mt-1 block text-[11px]">
                          {t("followUp")}
                          <input
                            type="datetime-local"
                            className="mt-0.5 block w-full rounded border px-1 py-0.5"
                            onChange={(e) => {
                              if (e.target.value) {
                                void scheduleFollowUp(lead.id, e.target.value);
                              }
                            }}
                          />
                        </label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {[1, 3, 5].map((d) => (
                            <button
                              key={d}
                              type="button"
                              className="rounded border px-1.5 py-0.5 text-[10px] text-[#2980B9]"
                              onClick={() =>
                                void scheduleFollowUpBusinessDays(lead.id, d)
                              }
                            >
                              +{d} {t("businessDays")}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-[#2980B9] underline"
                          onClick={() => convertLead(lead.id)}
                        >
                          {t("convert")}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
