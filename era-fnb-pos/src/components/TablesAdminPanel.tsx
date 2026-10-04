"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  type CatalogFieldKind,
  Field,
  FieldRow,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { CARD_CLASS } from "@/lib/design-system";

type Hall = { id: string; name: string; sortOrder: number; tableCount: number };

type TableRow = {
  id: string;
  code: string;
  name: string;
  seats: number;
  hallId?: string | null;
  status: string;
};

type Form = {
  id?: string;
  code: string;
  name: string;
  seats: string;
  hallId: string;
};

const emptyForm = (hallId: string): Form => ({
  code: "",
  name: "",
  seats: "4",
  hallId,
});

export default function TablesAdminPanel() {
  const t = useTranslations("admin.tables");
  const [halls, setHalls] = useState<Hall[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(""));
  const [hallModal, setHallModal] = useState<"create" | "edit" | null>(null);
  const [hallDraft, setHallDraft] = useState({ id: "", name: "" });

  const load = useCallback(async () => {
    const [tablesRes, hallsRes] = await Promise.all([fetch("/api/tables"), fetch("/api/halls")]);
    const tablesData = await tablesRes.json().catch(() => null);
    const hallsData = await hallsRes.json().catch(() => null);
    if (!tablesRes.ok) showApiError(tablesData, t("saveFailed"));
    if (!hallsRes.ok) showApiError(hallsData, t("saveFailed"));
    setTables(Array.isArray(tablesData) ? tablesData : []);
    setHalls(Array.isArray(hallsData) ? hallsData : []);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = tables.filter((row) => (row.hallId ?? null) === selectedHallId);

  function openCreate() {
    setForm(emptyForm(selectedHallId ?? ""));
    setModal("create");
  }

  function openEdit(row: TableRow) {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      seats: String(row.seats),
      hallId: row.hallId ?? "",
    });
    setModal("edit");
  }

  async function save() {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      seats: Number(form.seats) || 4,
      hallId: form.hallId || null,
    };
    const res =
      modal === "create"
        ? await fetch("/api/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/tables/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      const occupied =
        data.error === "Cannot delete occupied table" || data.code === "TABLE_OCCUPIED";
      if (occupied) showApiError({ error: t("occupiedDelete") });
      else showApiError({ error: data.error ?? t("saveFailed") });
      return;
    }
    await load();
  }

  async function saveHall() {
    const name = hallDraft.name.trim();
    if (!name) return;
    const res =
      hallModal === "create"
        ? await fetch("/api/halls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          })
        : await fetch(`/api/halls/${hallDraft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data?.code === "HALL_DUPLICATE" ? { error: t("hallDuplicate") } : data, t("saveFailed"));
      return;
    }
    if (hallModal === "create" && data?.id) setSelectedHallId(data.id);
    setHallModal(null);
    await load();
  }

  async function moveHall(id: string, direction: "up" | "down") {
    const res = await fetch(`/api/halls/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!res.ok) showApiError(await res.json().catch(() => null), t("saveFailed"));
    await load();
  }

  async function removeHall(id: string) {
    if (!confirm(t("confirmDeleteHall"))) return;
    const res = await fetch(`/api/halls/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(res.status === 409 ? { error: t("hallBusy") } : data, t("saveFailed"));
      return;
    }
    if (selectedHallId === id) setSelectedHallId(null);
    await load();
  }

  const hallOptions = [
    { value: "", label: t("mainHall") },
    ...halls.map((hall) => ({ value: hall.id, label: hall.name })),
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="mr-1 inline h-4 w-4" />
            {t("add")}
          </button>
        }
      />
      <div className="grid items-start gap-3 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className={`${CARD_CLASS} min-w-0 p-4`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#34495E]">{t("halls")}</p>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-[#2980B9] hover:bg-[#EBEDF0]"
              aria-label={t("addHall")}
              onClick={() => {
                setHallDraft({ id: "", name: "" });
                setHallModal("create");
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setSelectedHallId(null)}
                className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                  selectedHallId == null ? "bg-[#2980B9] text-white" : "text-[#34495E] hover:bg-[#EBEDF0]"
                }`}
              >
                {t("mainHall")}
              </button>
            </li>
            {halls.map((hall, index) => {
              const selected = hall.id === selectedHallId;
              return (
                <li key={hall.id} className="flex min-w-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedHallId(hall.id)}
                    className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                      selected ? "bg-[#2980B9] text-white" : "text-[#34495E] hover:bg-[#EBEDF0]"
                    }`}
                  >
                    {hall.name}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#7F8C8D] hover:bg-[#EBEDF0] disabled:opacity-30"
                    aria-label={t("moveUp")}
                    disabled={index === 0}
                    onClick={() => void moveHall(hall.id, "up")}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#7F8C8D] hover:bg-[#EBEDF0] disabled:opacity-30"
                    aria-label={t("moveDown")}
                    disabled={index === halls.length - 1}
                    onClick={() => void moveHall(hall.id, "down")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
                    aria-label={t("edit")}
                    onClick={() => {
                      setHallDraft({ id: hall.id, name: hall.name });
                      setHallModal("edit");
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#C0392B] hover:bg-[#EBEDF0]"
                    aria-label={t("delete")}
                    onClick={() => void removeHall(hall.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={`${CARD_CLASS} min-w-0 overflow-x-auto p-4`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
                <th className="px-1 py-2 pr-2">{t("code")}</th>
                <th className="py-2 pr-2">{t("name")}</th>
                <th className="py-2 pr-2">{t("seats")}</th>
                <th className="py-2 pr-2">{t("status")}</th>
                <th className="py-2 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-[#EEF1F3]">
                  <td className="px-1 py-2 pr-2 font-mono">{row.code}</td>
                  <td className="py-2 pr-2">{row.name}</td>
                  <td className="py-2 pr-2">{row.seats}</td>
                  <td className="py-2 pr-2">
                    {row.status === "OCCUPIED" ? t("statusOccupied") : t("statusFree")}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      aria-label={t("edit")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("delete")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-[#C0392B] hover:bg-[#EBEDF0]"
                      onClick={() => void remove(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-1 py-3 text-[#7F8C8D]">
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell
        open={modal != null}
        title={modal === "create" ? t("add") : t("edit")}
        onClose={() => setModal(null)}
      >
        <div className="flex flex-col gap-5">
          <FieldRow cols={2}>
            <Field
              label={t("code")}
              preset="code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Field
              label={t("seats")}
              preset="shortText"
              value={form.seats}
              onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
            />
          </FieldRow>
          <Field
            label={t("name")}
            preset="shortText"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <CatalogField
            kind={"CLOSED_SMALL" as CatalogFieldKind}
            label={t("halls")}
            value={form.hallId}
            options={hallOptions.filter((option) => option.value !== "")}
            emptyLabel={t("mainHall")}
            onChange={(next) =>
              setForm((current) => ({
                ...current,
                hallId: Array.isArray(next) ? next[0] ?? "" : next,
              }))
            }
          />
          <ModalFooter onCancel={() => setModal(null)} onSubmit={() => void save()} submitLabel={t("save")} />
        </div>
      </ModalShell>

      <ModalShell
        open={hallModal != null}
        title={hallModal === "create" ? t("addHall") : t("editHall")}
        onClose={() => setHallModal(null)}
      >
        <div className="flex flex-col gap-5">
          <Field
            label={t("hallName")}
            preset="shortText"
            value={hallDraft.name}
            onChange={(e) => setHallDraft((current) => ({ ...current, name: e.target.value }))}
          />
          <ModalFooter
            onCancel={() => setHallModal(null)}
            onSubmit={() => void saveHall()}
            submitLabel={t("save")}
          />
        </div>
      </ModalShell>
    </>
  );
}
