"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type Bed = { id: string; code: string; status: string };
type Ward = {
  id: string;
  code: string;
  name: string;
  dailyChargeCode?: string | null;
  beds: Bed[];
};

type WardForm = { code: string; name: string; dailyChargeCode: string; bedCode: string; bedStatus: string };
type ConfirmAction = { type: "ward" | "bed"; id: string; label: string } | null;

export default function WardsAdminPage() {
  const t = useTranslations("masterData");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardOpen, setWardOpen] = useState(false);
  const [bedOpen, setBedOpen] = useState(false);
  const [editingWardId, setEditingWardId] = useState<string | null>(null);
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [selectedWardId, setSelectedWardId] = useState("");
  const [form, setForm] = useState<WardForm>({
    code: "",
    name: "",
    dailyChargeCode: "",
    bedCode: "",
    bedStatus: "AVAILABLE",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/wards");
    const d = await res.json();
    setWards((d.data ?? d) as Ward[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm({ code: "", name: "", dailyChargeCode: "", bedCode: "", bedStatus: "AVAILABLE" });
  }

  function openCreateWard() {
    setEditingWardId(null);
    resetForm();
    setWardOpen(true);
  }

  function openEditWard(ward: Ward) {
    setEditingWardId(ward.id);
    setForm({
      code: ward.code,
      name: ward.name,
      dailyChargeCode: ward.dailyChargeCode ?? "",
      bedCode: "",
      bedStatus: "AVAILABLE",
    });
    setWardOpen(true);
  }

  function openCreateBed(wardId: string) {
    setEditingBedId(null);
    setSelectedWardId(wardId);
    setForm((f) => ({ ...f, bedCode: "", bedStatus: "AVAILABLE" }));
    setBedOpen(true);
  }

  function openEditBed(wardId: string, bed: Bed) {
    setEditingBedId(bed.id);
    setSelectedWardId(wardId);
    setForm((f) => ({ ...f, bedCode: bed.code, bedStatus: bed.status }));
    setBedOpen(true);
  }

  async function saveWard() {
    setMsg(null);
    if (editingWardId) {
      const res = await fetch(`/api/admin/wards/${editingWardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          dailyChargeCode: form.dailyChargeCode || null,
        }),
      });
      if (!res.ok) {
        setMsg(tc("saveFailed"));
        return;
      }
    } else {
      const res = await fetch("/api/admin/wards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          dailyChargeCode: form.dailyChargeCode || undefined,
        }),
      });
      if (!res.ok) {
        setMsg(tc("saveFailed"));
        return;
      }
    }
    setWardOpen(false);
    resetForm();
    await load();
  }

  async function saveBed() {
    setMsg(null);
    if (editingBedId) {
      const res = await fetch(`/api/admin/beds/${editingBedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.bedCode,
          status: form.bedStatus,
        }),
      });
      if (!res.ok) {
        setMsg(tc("saveFailed"));
        return;
      }
    } else {
      const res = await fetch(`/api/admin/wards/${selectedWardId}/beds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.bedCode }),
      });
      if (!res.ok) {
        setMsg(tc("saveFailed"));
        return;
      }
    }
    setBedOpen(false);
    resetForm();
    await load();
  }

  async function confirmDelete() {
    if (!confirm) return;
    setMsg(null);
    const url =
      confirm.type === "ward"
        ? `/api/admin/wards/${confirm.id}`
        : `/api/admin/beds/${confirm.id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.message ?? data.error ?? tc("saveFailed"));
    }
    setConfirm(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("wards")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link href="/admin/master-data" className={SECONDARY_BUTTON_CLASS}>
              ← {tNav("masterData")}
            </Link>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreateWard}>
              {t("addWard")}
            </button>
          </>
        }
      />
      {msg ? <p className={`mb-3 text-[13px] ${TEXT_DANGER_CLASS}`}>{msg}</p> : null}
      <div className="space-y-4">
        {wards.map((ward) => (
          <section key={ward.id} className={`${CARD_CONTAINER_CLASS} p-4`}>
            <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{ward.name}</h2>
                <p className={`text-xs ${TEXT_MUTED_CLASS}`}>
                  {ward.code}
                  {ward.dailyChargeCode ? ` · ${ward.dailyChargeCode}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc("edit")}
                  onClick={() => openEditWard(ward)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc("delete")}
                  onClick={() => setConfirm({ type: "ward", id: ward.id, label: ward.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => openCreateBed(ward.id)}>
                  {t("addBed")}
                </button>
              </div>
            </header>
            <ul className="flex flex-wrap gap-2 text-[13px]">
              {ward.beds.map((bed) => (
                <li key={bed.id} className="flex items-center gap-1 rounded border px-2 py-1">
                  <span>
                    {bed.code} · {bed.status}
                  </span>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={tc("edit")}
                    onClick={() => openEditBed(ward.id, bed)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={tc("delete")}
                    onClick={() => setConfirm({ type: "bed", id: bed.id, label: bed.code })}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              {ward.beds.length === 0 ? <li className={TEXT_MUTED_CLASS}>{t("noBeds")}</li> : null}
            </ul>
          </section>
        ))}
      </div>

      <ModalShell
        open={wardOpen}
        title={editingWardId ? t("editWard") : t("wards")}
        onClose={() => setWardOpen(false)}
      >
        <div className={FORM_STACK_CLASS}>
          {!editingWardId ? (
            <Field
              label={t("wardCode")}
              preset="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          ) : null}
          <Field
            label={t("wardName")}
            preset="shortText"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label={t("dailyChargeCode")}
            preset="code"
            value={form.dailyChargeCode}
            onChange={(e) => setForm({ ...form, dailyChargeCode: e.target.value })}
          />
        </div>
        <ModalFooter onCancel={() => setWardOpen(false)} onSubmit={() => void saveWard()} submitLabel={tc("save")} />
      </ModalShell>

      <ModalShell
        open={bedOpen}
        title={editingBedId ? t("editBed") : t("bedCode")}
        onClose={() => setBedOpen(false)}
      >
        <div className={FORM_STACK_CLASS}>
          <Field
            label={t("bedCode")}
            preset="code"
            value={form.bedCode}
            onChange={(e) => setForm({ ...form, bedCode: e.target.value })}
          />
          {editingBedId ? (
            <FieldSelect
              label={tc("status")}
              preset="select"
              value={form.bedStatus}
              onChange={(e) => setForm({ ...form, bedStatus: e.target.value })}
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="OCCUPIED">OCCUPIED</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </FieldSelect>
          ) : null}
        </div>
        <ModalFooter onCancel={() => setBedOpen(false)} onSubmit={() => void saveBed()} submitLabel={tc("save")} />
      </ModalShell>

      <ModalShell open={!!confirm} title={tc("confirmDelete")} onClose={() => setConfirm(null)}>
        <p className="text-[13px]">{confirm?.label}</p>
        <ModalFooter
          onCancel={() => setConfirm(null)}
          onSubmit={() => void confirmDelete()}
          submitLabel={tc("delete")}
        />
      </ModalShell>
    </>
  );
}
