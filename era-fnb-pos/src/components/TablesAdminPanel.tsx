"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  FieldRow,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { Pencil, Trash2 } from "lucide-react";
import { CARD_CLASS } from "@/lib/design-system";

type TableRow = {
  id: string;
  code: string;
  name: string;
  seats: number;
  zone: string | null;
  status: string;
};

type Form = {
  id?: string;
  code: string;
  name: string;
  seats: string;
  zone: string;
};

const emptyForm = (): Form => ({
  code: "",
  name: "",
  seats: "4",
  zone: "",
});

export default function TablesAdminPanel() {
  const t = useTranslations("admin.tables");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());

  const load = useCallback(async () => {
    const res = await fetch("/api/tables");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      setTables([]);
      return;
    }
    setTables(Array.isArray(data) ? data : []);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm());
    setModal("create");
  }

  function openEdit(row: TableRow) {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      seats: String(row.seats),
      zone: row.zone ?? "",
    });
    setModal("edit");
  }

  async function save() {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      seats: Number(form.seats) || 4,
      zone: form.zone.trim() || null,
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

  return (
    <>
      <div className="mb-4 flex justify-between gap-2">
        <p className="text-sm text-[#7F8C8D]">{t("subtitle")}</p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
          {t("add")}
        </button>
      </div>
      <div className={`${CARD_CLASS} overflow-x-auto p-4`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
              <th className="py-2 pr-2">{t("code")}</th>
              <th className="py-2 pr-2">{t("name")}</th>
              <th className="py-2 pr-2">{t("seats")}</th>
              <th className="py-2 pr-2">{t("zone")}</th>
              <th className="py-2 pr-2">{t("status")}</th>
              <th className="py-2 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((row) => (
              <tr key={row.id} className="border-b border-[#EEF1F3]">
                <td className="py-2 pr-2 font-mono">{row.code}</td>
                <td className="py-2 pr-2">{row.name}</td>
                <td className="py-2 pr-2">{row.seats}</td>
                <td className="py-2 pr-2">{row.zone || "—"}</td>
                <td className="py-2 pr-2">
                  {row.status === "OCCUPIED" ? t("statusOccupied") : t("statusFree")}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    aria-label={t("edit")}
                    title={t("edit")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("delete")}
                    title={t("delete")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-[#C0392B] hover:bg-[#EBEDF0]"
                    onClick={() => void remove(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {tables.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-[#7F8C8D]">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalShell
        open={modal != null}
        title={modal === "create" ? t("add") : t("edit")}
        onClose={() => setModal(null)}
      >
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
          <Field
            label={t("zone")}
            hint={t("zoneHint")}
            preset="shortText"
          value={form.zone}
          onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
        />
        <ModalFooter
          onCancel={() => setModal(null)}
          onSubmit={() => void save()}
          submitLabel={t("save")}
        />
      </ModalShell>
    </>
  );
}
