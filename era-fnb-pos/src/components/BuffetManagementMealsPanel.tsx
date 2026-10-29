"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { todayBakuYmd } from "@era/satellite-kit/time";
import {
  CatalogField,
  Field,
  FieldRow,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { Trash2 } from "lucide-react";
import { CARD_CLASS } from "@/lib/design-system";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";

type MealRow = {
  id: string;
  serviceDate: string;
  meal: string;
  actorLabel: string;
  signedAt: string;
  notes: string | null;
};

type Props = {
  outletId: string;
  fromDate: string;
  toDate: string;
  onChanged?: () => void;
};

export default function BuffetManagementMealsPanel({
  outletId,
  fromDate,
  toDate,
  onChanged,
}: Props) {
  const t = useTranslations("admin.buffet");
  const [rows, setRows] = useState<MealRow[]>([]);
  const [open, setOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(todayBakuYmd());
  const [meal, setMeal] = useState("BREAKFAST");
  const [actorLabel, setActorLabel] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    if (!outletId) {
      setRows([]);
      return;
    }
    const q = new URLSearchParams({
      outletId,
      from: fromDate,
      to: toDate,
    });
    return fetch(`/api/admin/buffet/management-meals?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setRows(Array.isArray(d?.meals) ? (d.meals as MealRow[]) : []);
      })
      .catch(() => undefined);
  }, [outletId, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signIn() {
    const label = actorLabel.trim();
    if (!label) {
      showApiError({ error: t("actorRequired") }, t("saveFailed"));
      return;
    }
    const res = await fetch("/api/admin/buffet/management-meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        serviceDate,
        meal,
        actorLabel: label,
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("signFailed"));
      return;
    }
    setOpen(false);
    setActorLabel("");
    setNotes("");
    showSuccess(t("signed"));
    await load();
    onChanged?.();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/buffet/management-meals/${id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("signDeleteFailed"));
      return;
    }
    showSuccess(t("signDeleted"));
    await load();
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <p className="text-sm text-[#7F8C8D]">{t("managementHint")}</p>
        <div className="flex justify-end">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!outletId}
            onClick={() => {
              setServiceDate(fromDate || todayBakuYmd());
              setMeal("BREAKFAST");
              setActorLabel("");
              setNotes("");
              setOpen(true);
            }}
          >
            {t("signManagement")}
          </button>
        </div>
      </div>

      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="border-b px-3 py-2 text-sm font-semibold text-[#2C3E50]">
          {t("managementTitle")}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
            <tr>
              <th className="px-3 py-2 font-medium">{t("colDate")}</th>
              <th className="px-3 py-2 font-medium">{t("colMeal")}</th>
              <th className="px-3 py-2 font-medium">{t("colActor")}</th>
              <th className="px-3 py-2 font-medium">{t("colSignedAt")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#7F8C8D]">
                  {t("managementEmpty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.serviceDate}</td>
                  <td className="px-3 py-2">{t(`meal.${row.meal}`)}</td>
                  <td className="px-3 py-2">{row.actorLabel}</td>
                  <td className="px-3 py-2 text-xs text-[#7F8C8D]">
                    {row.signedAt.replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void remove(row.id)}
                      aria-label={t("signDelete")}
                      title={t("signDelete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalShell open={open} title={t("signManagement")} onClose={() => setOpen(false)}>
        <FieldRow cols={2}>
          <Field
            label={t("serviceDate")}
            preset="date"
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("mealLabel")}
            options={BUFFET_MEALS.map((m) => ({ value: m, label: t(`meal.${m}`) }))}
            value={meal}
            onChange={(next) => setMeal(String(next ?? "BREAKFAST"))}
          />
        </FieldRow>
        <CatalogField
          kind="FREE_TEXT"
          label={t("actorLabel")}
          options={[]}
          value={actorLabel}
          onChange={(next) => setActorLabel(String(next ?? ""))}
        />
        <CatalogField
          kind="FREE_TEXT"
          label={t("notes")}
          options={[]}
          value={notes}
          onChange={(next) => setNotes(String(next ?? ""))}
        />
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => void signIn()}
          submitLabel={t("signManagement")}
        />
      </ModalShell>
    </div>
  );
}
