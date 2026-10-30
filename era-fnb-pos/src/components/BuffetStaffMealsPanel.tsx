"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import { ISO_WEEKDAYS } from "@/lib/buffet-week-calendar";

type StaffPlan = {
  id: string;
  name: string;
  active: boolean;
  slots: Array<{
    id: string;
    weekday: number;
    meal: string;
    coversStaff: number;
  }>;
};

type Props = {
  outletId: string;
  onChanged?: () => void;
};

export default function BuffetStaffMealsPanel({ outletId, onChanged }: Props) {
  const t = useTranslations("admin.buffet");
  const [plans, setPlans] = useState<StaffPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotWeekday, setSlotWeekday] = useState("1");
  const [slotMeal, setSlotMeal] = useState("BREAKFAST");
  const [slotCovers, setSlotCovers] = useState("0");

  const selected = plans.find((row) => row.id === planId) ?? null;

  const loadPlans = useCallback(() => {
    if (!outletId) {
      setPlans([]);
      setPlanId("");
      return;
    }
    return fetch(`/api/admin/buffet/staff-plans?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = Array.isArray(d?.plans) ? (d.plans as StaffPlan[]) : [];
        setPlans(rows);
        setPlanId((prev) =>
          rows.some((r) => r.id === prev)
            ? prev
            : rows.find((r) => r.active)?.id || rows[0]?.id || "",
        );
      })
      .catch(() => undefined);
  }, [outletId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function createPlan() {
    if (!outletId) return;
    const res = await fetch("/api/admin/buffet/staff-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        name: nameDraft.trim() || t("defaultStaffPlanName"),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("staffPlanCreateFailed"));
      return;
    }
    showSuccess(t("staffPlanCreated"));
    await loadPlans();
    if (data?.id) setPlanId(data.id);
    onChanged?.();
  }

  async function makePlanActive() {
    if (!planId || selected?.active) return;
    const res = await fetch(`/api/admin/buffet/staff-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("staffPlanActivateFailed"));
      return;
    }
    showSuccess(t("staffPlanActivated"));
    await loadPlans();
    onChanged?.();
  }

  async function saveSlot() {
    if (!planId) return;
    const res = await fetch(`/api/admin/buffet/staff-plans/${planId}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekday: Number(slotWeekday),
        meal: slotMeal,
        coversStaff: Number(slotCovers) || 0,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setSlotOpen(false);
    showSuccess(t("staffSlotSaved"));
    setPlans((rows) => rows.map((row) => (row.id === planId ? (data as StaffPlan) : row)));
    onChanged?.();
  }

  async function deleteSlot(weekday: number, meal: string) {
    if (!planId) return;
    const q = new URLSearchParams({ weekday: String(weekday), meal });
    const res = await fetch(`/api/admin/buffet/staff-plans/${planId}/slots?${q}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("staffSlotDeleteFailed"));
      return;
    }
    showSuccess(t("staffSlotDeleted"));
    setPlans((rows) => rows.map((row) => (row.id === planId ? (data as StaffPlan) : row)));
    onChanged?.();
  }

  const weekdayOptions = ISO_WEEKDAYS.map((d) => ({
    value: String(d),
    label: t(`weekday.${d}`),
  }));
  const mealOptions = BUFFET_MEALS.map((m) => ({
    value: m,
    label: t(`meal.${m}`),
  }));

  return (
    <div className="space-y-4">
      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <p className="text-sm text-[#7F8C8D]">{t("staffHint")}</p>
        <p className="text-xs text-[#95A5A6]">{t("staffCompositionLater")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label={t("staffPlanName")}
            preset="shortText"
            value={nameDraft}
            placeholder={t("defaultStaffPlanName")}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!outletId}
            onClick={() => void createPlan()}
          >
            {t("newStaffPlan")}
          </button>
        </div>
        {plans.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <CatalogField
                kind="ENTITY_REF"
                label={t("staffPlan")}
                options={plans.map((row) => ({
                  value: row.id,
                  label: `${row.name}${row.active ? "" : ` (${t("templateInactive")})`}`,
                }))}
                value={planId}
                onChange={(next) => setPlanId(String(next ?? ""))}
              />
            </div>
            {selected && !selected.active ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void makePlanActive()}
              >
                {t("makeActive")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[#7F8C8D]">{t("staffPlansEmpty")}</p>
        )}
        {selected && !selected.active ? (
          <p className="text-xs text-[#E67E22]">{t("staffPlanInactiveHint")}</p>
        ) : null}
      </div>

      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <p className="m-0 text-sm text-[#7F8C8D]">
          {t("overlapMovedToSettings")}{" "}
          <Link href="/admin/settings" className="text-[#2980B9] underline">
            {t("overlapSettingsLink")}
          </Link>
        </p>
      </div>

      {selected ? (
        <div className={`${CARD_CLASS} overflow-hidden`}>
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-semibold text-[#2C3E50]">{t("staffSlotsTitle")}</div>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => {
                setSlotWeekday("1");
                setSlotMeal("BREAKFAST");
                setSlotCovers("0");
                setSlotOpen(true);
              }}
            >
              {t("editStaffSlot")}
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
              <tr>
                <th className="px-3 py-2 font-medium">{t("colWeekday")}</th>
                <th className="px-3 py-2 font-medium">{t("colMeal")}</th>
                <th className="px-3 py-2 font-medium">{t("colStaffCovers")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {selected.slots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[#7F8C8D]">
                    {t("staffSlotsEmpty")}
                  </td>
                </tr>
              ) : (
                selected.slots.map((slot) => (
                  <tr
                    key={slot.id}
                    className="cursor-pointer hover:bg-[#F8FAFC]"
                    onDoubleClick={() => {
                      setSlotWeekday(String(slot.weekday));
                      setSlotMeal(slot.meal);
                      setSlotCovers(String(slot.coversStaff));
                      setSlotOpen(true);
                    }}
                  >
                    <td className="px-3 py-2">{t(`weekday.${slot.weekday}`)}</td>
                    <td className="px-3 py-2">{t(`meal.${slot.meal}`)}</td>
                    <td className="px-3 py-2 tabular-nums">{slot.coversStaff}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteSlot(slot.weekday, slot.meal);
                        }}
                      >
                        {t("deleteSlot")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <ModalShell open={slotOpen} title={t("editStaffSlot")} onClose={() => setSlotOpen(false)}>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colWeekday")}
          options={weekdayOptions}
          value={slotWeekday}
          onChange={(next) => setSlotWeekday(String(next ?? "1"))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("mealLabel")}
          options={mealOptions}
          value={slotMeal}
          onChange={(next) => setSlotMeal(String(next ?? "BREAKFAST"))}
        />
        <Field
          label={t("coversStaff")}
          preset="shortText"
          type="number"
          min={0}
          value={slotCovers}
          onChange={(e) => setSlotCovers(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setSlotOpen(false)}
          onSubmit={() => void saveSlot()}
          submitLabel={t("saveStaffSlot")}
        />
      </ModalShell>
    </div>
  );
}
