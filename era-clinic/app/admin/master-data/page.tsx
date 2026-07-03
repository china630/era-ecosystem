"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldRow,
  FieldSelect,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Practitioner = {
  id: string;
  code: string;
  fullName: string;
  specialty?: string | null;
  globalPersonId?: string | null;
  financeEmployeeId?: string | null;
  defaultSlotMinutes?: number | null;
};

type WorkforcePolicy = {
  hireMode: "cp_workforce" | "disabled";
};

type IdentifierChip = { type: string; isPrimary: boolean };

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

type Room = { id: string; code: string; name: string };
type Resource = {
  id: string;
  code: string;
  name: string;
  kind: string;
  capacity: number;
  room?: { code: string } | null;
};
type ProcedureType = {
  id: string;
  code: string;
  name: string;
  durationMin: number;
};

type Tab = "practitioners" | "rooms" | "resources" | "procedureTypes";

export default function MasterDataPage() {
  const t = useTranslations("masterData");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<Tab>("practitioners");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [globalPersonId, setGlobalPersonId] = useState<string | null>(null);
  const [identifierTypes, setIdentifierTypes] = useState<IdentifierChip[]>([]);
  const [workforcePolicy, setWorkforcePolicy] = useState<WorkforcePolicy | null>(null);

  const cpWorkforceMode = workforcePolicy?.hireMode === "cp_workforce";
  const blockPractitionerCreate = cpWorkforceMode;

  const loadAll = useCallback(async () => {
    const [p, r, res, pt, wp] = await Promise.all([
      fetch("/api/admin/practitioners").then((x) => x.json()),
      fetch("/api/admin/rooms").then((x) => x.json()),
      fetch("/api/admin/resources").then((x) => x.json()),
      fetch("/api/admin/procedure-types").then((x) => x.json()),
      fetch("/api/admin/workforce-policy").then((x) => x.json()),
    ]);
    setPractitioners((p.data ?? p) as Practitioner[]);
    setRooms((r.data ?? r) as Room[]);
    setResources((res.data ?? res) as Resource[]);
    setProcedureTypes((pt.data ?? pt) as ProcedureType[]);
    const policyPayload = (wp.data ?? wp) as WorkforcePolicy;
    if (policyPayload?.hireMode) setWorkforcePolicy(policyPayload);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openCreate() {
    if (tab === "practitioners" && blockPractitionerCreate) return;
    setEditingId(null);
    setForm({});
    setMdmStatus(null);
    setGlobalPersonId(null);
    setIdentifierTypes([]);
    setModalOpen(true);
  }

  async function openEdit(row: Record<string, string>, id: string, practitioner?: Practitioner) {
    setEditingId(id);
    setForm({
      code: row.code ?? "",
      fullName: row.fullName ?? "",
      specialty: row.specialty ?? "",
      finCode: "",
      passportNumber: "",
      issuingCountry: "",
      defaultSlotMinutes: row.defaultSlotMinutes ?? "30",
    });
    setGlobalPersonId(practitioner?.globalPersonId ?? null);
    setMdmStatus(
      practitioner?.globalPersonId
        ? t("mdmLinked", { id: maskPersonId(practitioner.globalPersonId) })
        : null,
    );
    if (practitioner?.globalPersonId) {
      const res = await fetch(
        `/api/mdm/person-identifiers?globalPersonId=${encodeURIComponent(practitioner.globalPersonId)}`,
      );
      const parsed = await res.json();
      const payload = (parsed.data ?? parsed) as { identifiers?: IdentifierChip[] };
      setIdentifierTypes(payload.identifiers ?? []);
    } else {
      setIdentifierTypes([]);
    }
    setModalOpen(true);
  }

  async function lookupMdm() {
    const fullName = (form.fullName ?? form.name ?? "").trim();
    if (!fullName) {
      setMdmStatus(t("nameRequired"));
      return;
    }
    const res = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fin: form.finCode?.trim() || undefined,
        passport: form.passportNumber?.trim() || undefined,
        issuingCountry: form.issuingCountry?.trim() || undefined,
        fullName,
        phone: form.phone?.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.globalPersonId) {
      setGlobalPersonId(data.globalPersonId);
      setMdmStatus(t("mdmLinked", { id: maskPersonId(data.globalPersonId) }));
    } else {
      setGlobalPersonId(null);
      setMdmStatus(t("mdmNotFound"));
    }
  }

  async function save() {
    setMsg(null);
    const base =
      tab === "practitioners"
        ? "/api/admin/practitioners"
        : tab === "rooms"
          ? "/api/admin/rooms"
          : tab === "resources"
            ? "/api/admin/resources"
            : "/api/admin/procedure-types";

    let payload: Record<string, unknown> = {};
    if (editingId) {
      if (tab === "practitioners") {
        const opsOnly =
          cpWorkforceMode ||
          Boolean(practitioners.find((x) => x.id === editingId)?.financeEmployeeId);
        payload = opsOnly
          ? {
              specialty: form.specialty || null,
              defaultSlotMinutes: form.defaultSlotMinutes
                ? Number(form.defaultSlotMinutes)
                : undefined,
            }
          : {
              fullName: form.fullName ?? form.name,
              specialty: form.specialty || null,
              finCode: form.finCode?.trim() || undefined,
              passportNumber: form.passportNumber?.trim() || undefined,
              issuingCountry: form.issuingCountry?.trim() || undefined,
              globalPersonId: globalPersonId || undefined,
              defaultSlotMinutes: form.defaultSlotMinutes
                ? Number(form.defaultSlotMinutes)
                : undefined,
            };
      } else if (tab === "rooms") {
        payload = { name: form.name };
      } else if (tab === "resources") {
        payload = {
          name: form.name,
          kind: form.kind || "EQUIPMENT",
          capacity: Number(form.capacity || "1"),
        };
      } else {
        payload = {
          name: form.name ?? form.fullName,
          durationMin: Number(form.durationMin || "30"),
          resourceCode: form.resourceCode || null,
        };
      }
    } else if (tab === "practitioners") {
      payload = {
        code: form.code,
        fullName: form.fullName ?? form.name,
        specialty: form.specialty || undefined,
        finCode: form.finCode?.trim() || undefined,
        passportNumber: form.passportNumber?.trim() || undefined,
        issuingCountry: form.issuingCountry?.trim() || undefined,
        globalPersonId: globalPersonId || undefined,
        defaultSlotMinutes: form.defaultSlotMinutes
          ? Number(form.defaultSlotMinutes)
          : undefined,
      };
    } else if (tab === "rooms") {
      payload = { code: form.code, name: form.name };
    } else if (tab === "resources") {
      payload = {
        code: form.code,
        name: form.name,
        kind: form.kind || "EQUIPMENT",
        capacity: Number(form.capacity || "1"),
      };
    } else {
      payload = {
        code: form.code,
        name: form.name,
        durationMin: Number(form.durationMin || "30"),
        resourceCode: form.resourceCode || undefined,
      };
    }

    const url = editingId ? `${base}/${editingId}` : base;
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setMsg(tc("saveFailed"));
      return;
    }
    setModalOpen(false);
    setMsg(tc("saved"));
    await loadAll();
  }

  async function remove(id: string) {
    if (!window.confirm(tc("confirmDelete"))) return;
    const base =
      tab === "practitioners"
        ? `/api/admin/practitioners/${id}`
        : tab === "rooms"
          ? `/api/admin/rooms/${id}`
          : tab === "resources"
            ? `/api/admin/resources/${id}`
            : `/api/admin/procedure-types/${id}`;
    await fetch(base, { method: "DELETE" });
    await loadAll();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "practitioners", label: t("practitioners") },
    { id: "rooms", label: t("rooms") },
    { id: "resources", label: t("resources") },
    { id: "procedureTypes", label: t("procedureTypes") },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link href="/admin/wards" className={SECONDARY_BUTTON_CLASS}>
              {t("wardsLink")}
            </Link>
            {!(tab === "practitioners" && blockPractitionerCreate) ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                {tc("add")}
              </button>
            ) : null}
          </>
        }
      />
      {cpWorkforceMode && tab === "practitioners" ? (
        <p className="mb-3 rounded border border-[#D5DBDB] bg-[#F8F9FA] p-3 text-[13px] text-[#2C3E50]">
          {t("workforceHireViaCp")}
        </p>
      ) : null}
      {msg ? <p className="mb-3 text-[13px] text-[#2C3E50]">{msg}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
        {tab === "practitioners" && (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[#7F8C8D]">
                <th className="p-2">{t("code")}</th>
                <th className="p-2">{t("name")}</th>
                <th className="p-2">{t("specialty")}</th>
                <th className="p-2">{t("mdmBadge")}</th>
                <th className="p-2">{t("financeLinked")}</th>
                <th className="p-2">{t("defaultSlotMinutes")}</th>
                <th className="p-2 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {practitioners.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.code}</td>
                  <td className="p-2">{row.fullName}</td>
                  <td className="p-2">{row.specialty ?? "—"}</td>
                  <td className="p-2">
                    {row.globalPersonId ? (
                      <span className="text-[#27AE60]">{maskPersonId(row.globalPersonId)}</span>
                    ) : (
                      <span className="text-[#C0392B]">{t("mdmMissing")}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {row.financeEmployeeId ? (
                      <span className="text-[#2980B9]">{t("financeLinkedYes")}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">{row.defaultSlotMinutes ?? "—"}</td>
                  <td className="p-2 text-right space-x-2">
                    <button type="button" className="text-[#2980B9]" onClick={() => void openEdit({ code: row.code, fullName: row.fullName, specialty: row.specialty ?? "", defaultSlotMinutes: String(row.defaultSlotMinutes ?? "30") }, row.id, row)}>
                      {tc("edit")}
                    </button>
                    <button type="button" className="text-[#C0392B]" onClick={() => void remove(row.id)}>
                      {tc("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "rooms" && (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[#7F8C8D]">
                <th className="p-2">{t("code")}</th>
                <th className="p-2">{t("name")}</th>
                <th className="p-2 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.code}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2 text-right space-x-2">
                    <button type="button" className="text-[#2980B9]" onClick={() => openEdit({ code: row.code, name: row.name }, row.id)}>
                      {tc("edit")}
                    </button>
                    <button type="button" className="text-[#C0392B]" onClick={() => void remove(row.id)}>
                      {tc("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "resources" && (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[#7F8C8D]">
                <th className="p-2">{t("code")}</th>
                <th className="p-2">{t("name")}</th>
                <th className="p-2">{t("kind")}</th>
                <th className="p-2 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.code}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.kind}</td>
                  <td className="p-2 text-right space-x-2">
                    <button type="button" className="text-[#2980B9]" onClick={() => openEdit({ code: row.code, name: row.name, kind: row.kind, capacity: String(row.capacity) }, row.id)}>
                      {tc("edit")}
                    </button>
                    <button type="button" className="text-[#C0392B]" onClick={() => void remove(row.id)}>
                      {tc("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "procedureTypes" && (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[#7F8C8D]">
                <th className="p-2">{t("code")}</th>
                <th className="p-2">{t("name")}</th>
                <th className="p-2">{t("durationMin")}</th>
                <th className="p-2 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {procedureTypes.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.code}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.durationMin}</td>
                  <td className="p-2 text-right space-x-2">
                    <button type="button" className="text-[#2980B9]" onClick={() => openEdit({ code: row.code, name: row.name, durationMin: String(row.durationMin) }, row.id)}>
                      {tc("edit")}
                    </button>
                    <button type="button" className="text-[#C0392B]" onClick={() => void remove(row.id)}>
                      {tc("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalShell
        open={modalOpen}
        title={editingId ? tc("edit") : tc("add")}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {!editingId && (tab === "practitioners" || tab === "rooms" || tab === "resources" || tab === "procedureTypes") && (
            <Field label={t("code")} preset="code" value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          )}
          {(tab === "practitioners" || tab === "resources" || tab === "procedureTypes") && (
            <Field
              label={t("name")}
              preset="shortText"
              value={form.fullName ?? form.name ?? ""}
              onChange={(e) => setForm({ ...form, fullName: e.target.value, name: e.target.value })}
            />
          )}
          {tab === "rooms" && (
            <Field label={t("name")} preset="shortText" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          )}
          {tab === "practitioners" && (
            <>
              {(editingId &&
                (cpWorkforceMode ||
                  practitioners.find((x) => x.id === editingId)?.financeEmployeeId)) ? (
                <p className="text-[13px] text-[#7F8C8D]">
                  {form.fullName} · {form.code}
                </p>
              ) : null}
              {!(
                editingId &&
                (cpWorkforceMode ||
                  practitioners.find((x) => x.id === editingId)?.financeEmployeeId)
              ) ? (
                <>
                  <Field
                    label={t("specialty")}
                    preset="shortText"
                    value={form.specialty ?? ""}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  />
                  <FieldRow cols={2} className="items-end">
                    <Field
                      label={t("finCode")}
                      preset="fin"
                      value={form.finCode ?? ""}
                      onChange={(e) => setForm({ ...form, finCode: e.target.value.toUpperCase() })}
                    />
                    <button type="button" className={`${SECONDARY_BUTTON_CLASS} self-end`} onClick={() => void lookupMdm()}>
                      {t("mdmLookup")}
                    </button>
                  </FieldRow>
                  {mdmStatus ? <p className="text-xs text-[#7F8C8D]">{mdmStatus}</p> : null}
                  {identifierTypes.length > 0 ? (
                    <p className="text-xs text-[#7F8C8D]">
                      {t("identifierTypes")}: {identifierTypes.map((i) => i.type).join(", ")}
                    </p>
                  ) : null}
                  <FieldRow cols={2}>
                    <Field
                      label={t("passportNumber")}
                      preset="code"
                      value={form.passportNumber ?? ""}
                      onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
                    />
                    <Field
                      label={t("issuingCountry")}
                      preset="code"
                      value={form.issuingCountry ?? ""}
                      onChange={(e) => setForm({ ...form, issuingCountry: e.target.value.toUpperCase() })}
                    />
                  </FieldRow>
                </>
              ) : (
                <Field
                  label={t("specialty")}
                  preset="shortText"
                  value={form.specialty ?? ""}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              )}
              <Field
                label={t("defaultSlotMinutes")}
                preset="count"
                value={form.defaultSlotMinutes ?? "30"}
                onChange={(e) => setForm({ ...form, defaultSlotMinutes: e.target.value })}
              />
            </>
          )}
          {tab === "resources" && (
            <>
              <FieldSelect
                label={t("kind")}
                preset="select"
                value={form.kind ?? "EQUIPMENT"}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="EQUIPMENT">EQUIPMENT</option>
                <option value="ROOM">ROOM</option>
              </FieldSelect>
              <Field
                label={t("capacity")}
                preset="count"
                value={form.capacity ?? "1"}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </>
          )}
          {tab === "procedureTypes" && (
            <FieldRow cols={2}>
              <Field
                label={t("durationMin")}
                preset="count"
                value={form.durationMin ?? "30"}
                onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
              />
              <Field
                label={t("resourceCode")}
                preset="code"
                value={form.resourceCode ?? ""}
                onChange={(e) => setForm({ ...form, resourceCode: e.target.value })}
              />
            </FieldRow>
          )}
        </div>
        <ModalFooter onCancel={() => setModalOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </>
  );
}
