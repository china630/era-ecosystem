"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { todayBakuYmd } from "@era/satellite-kit/time";
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
import { ISO_WEEKDAYS, mondayOfWeekYmd } from "@/lib/buffet-week-calendar";

type Template = {
  id: string;
  name: string;
  active: boolean;
  slots: Array<{
    id: string;
    weekday: number;
    meal: string;
    coversAdult: number;
    coversChild: number;
    lines: Array<{ id: string; name: string; plannedPortions: number }>;
  }>;
};

type Props = {
  outletId: string;
  planOptions: Array<{ value: string; label: string }>;
  onSpawned: () => void;
};

export default function BuffetWeekTemplatePanel({
  outletId,
  planOptions,
  onSpawned,
}: Props) {
  const t = useTranslations("admin.buffet");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekYmd(todayBakuYmd()));
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotWeekday, setSlotWeekday] = useState("1");
  const [slotMeal, setSlotMeal] = useState("BREAKFAST");
  const [slotAdult, setSlotAdult] = useState("0");
  const [slotChild, setSlotChild] = useState("0");
  const [capturePlanId, setCapturePlanId] = useState("");

  const selected = templates.find((row) => row.id === templateId) ?? null;

  const load = useCallback(() => {
    if (!outletId) {
      setTemplates([]);
      setTemplateId("");
      return;
    }
    return fetch(`/api/admin/buffet/templates?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = Array.isArray(d?.templates) ? (d.templates as Template[]) : [];
        setTemplates(rows);
        setTemplateId((prev) =>
          rows.some((r) => r.id === prev)
            ? prev
            : rows.find((r) => r.active)?.id || rows[0]?.id || "",
        );
      })
      .catch(() => undefined);
  }, [outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate() {
    if (!outletId) return;
    const res = await fetch("/api/admin/buffet/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        name: nameDraft.trim() || t("defaultTemplateName"),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("templateCreateFailed"));
      return;
    }
    showSuccess(t("templateCreated"));
    await load();
    if (data?.id) setTemplateId(data.id);
  }

  async function saveSlot() {
    if (!templateId) return;
    const res = await fetch(`/api/admin/buffet/templates/${templateId}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekday: Number(slotWeekday),
        meal: slotMeal,
        coversAdult: Number(slotAdult) || 0,
        coversChild: Number(slotChild) || 0,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setSlotOpen(false);
    showSuccess(t("slotSaved"));
    setTemplates((rows) =>
      rows.map((row) => (row.id === templateId ? (data as Template) : row)),
    );
  }

  async function captureFromPlan() {
    if (!templateId || !capturePlanId) {
      showApiError({ error: t("capturePlanRequired") }, t("saveFailed"));
      return;
    }
    const res = await fetch(`/api/admin/buffet/templates/${templateId}/capture-from-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: capturePlanId,
        weekday: Number(slotWeekday),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("captureFailed"));
      return;
    }
    setSlotOpen(false);
    showSuccess(t("slotCaptured"));
    setTemplates((rows) =>
      rows.map((row) => (row.id === templateId ? (data as Template) : row)),
    );
  }

  async function deleteSlot(weekday: number, meal: string) {
    if (!templateId) return;
    const q = new URLSearchParams({
      weekday: String(weekday),
      meal,
    });
    const res = await fetch(`/api/admin/buffet/templates/${templateId}/slots?${q}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("slotDeleteFailed"));
      return;
    }
    showSuccess(t("slotDeleted"));
    setTemplates((rows) =>
      rows.map((row) => (row.id === templateId ? (data as Template) : row)),
    );
  }

  async function spawnWeek() {
    if (!templateId) return;
    const res = await fetch(`/api/admin/buffet/templates/${templateId}/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, skipExisting: true }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("spawnFailed"));
      return;
    }
    const created = Array.isArray(data?.created) ? data.created.length : 0;
    const skipped = Array.isArray(data?.skipped) ? data.skipped.length : 0;
    showSuccess(t("spawned", { created, skipped }));
    onSpawned();
  }

  async function makeTemplateActive() {
    if (!templateId || selected?.active) return;
    const res = await fetch(`/api/admin/buffet/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("templateActivateFailed"));
      return;
    }
    showSuccess(t("templateActivated"));
    await load();
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
        <p className="text-sm text-[#7F8C8D]">{t("templateHint")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label={t("templateName")}
            preset="shortText"
            value={nameDraft}
            placeholder={t("defaultTemplateName")}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!outletId}
            onClick={() => void createTemplate()}
          >
            {t("newTemplate")}
          </button>
        </div>
        {templates.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <CatalogField
                kind="ENTITY_REF"
                label={t("template")}
                options={templates.map((row) => ({
                  value: row.id,
                  label: `${row.name}${row.active ? "" : ` (${t("templateInactive")})`}`,
                }))}
                value={templateId}
                onChange={(next) => setTemplateId(String(next ?? ""))}
              />
            </div>
            {selected && !selected.active ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void makeTemplateActive()}
              >
                {t("makeActive")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[#7F8C8D]">{t("templatesEmpty")}</p>
        )}
      </div>

      {selected ? (
        <>
          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="text-sm font-semibold text-[#2C3E50]">{t("slotsTitle")}</div>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setSlotWeekday("1");
                  setSlotMeal("BREAKFAST");
                  setSlotAdult("0");
                  setSlotChild("0");
                  setCapturePlanId("");
                  setSlotOpen(true);
                }}
              >
                {t("editSlot")}
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("colWeekday")}</th>
                  <th className="px-3 py-2 font-medium">{t("colMeal")}</th>
                  <th className="px-3 py-2 font-medium">{t("colCovers")}</th>
                  <th className="px-3 py-2 font-medium">{t("colLines")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {selected.slots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#7F8C8D]">
                      {t("slotsEmpty")}
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
                        setSlotAdult(String(slot.coversAdult));
                        setSlotChild(String(slot.coversChild));
                        setCapturePlanId("");
                        setSlotOpen(true);
                      }}
                    >
                      <td className="px-3 py-2">{t(`weekday.${slot.weekday}`)}</td>
                      <td className="px-3 py-2">{t(`meal.${slot.meal}`)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {slot.coversAdult + slot.coversChild}{" "}
                        <span className="text-xs text-[#7F8C8D]">
                          ({slot.coversAdult}/{slot.coversChild})
                        </span>
                      </td>
                      <td className="px-3 py-2">{slot.lines.length}</td>
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

          <div className={`${CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
            <Field
              label={t("weekStart")}
              preset="date"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(mondayOfWeekYmd(e.target.value || todayBakuYmd()))}
            />
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void spawnWeek()}>
              {t("spawnWeek")}
            </button>
            <p className="w-full text-xs text-[#7F8C8D]">{t("spawnHint")}</p>
          </div>
        </>
      ) : null}

      <ModalShell open={slotOpen} title={t("editSlot")} onClose={() => setSlotOpen(false)}>
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
          label={t("coversAdult")}
          preset="shortText"
          type="number"
          min={0}
          value={slotAdult}
          onChange={(e) => setSlotAdult(e.target.value)}
        />
        <Field
          label={t("coversChild")}
          preset="shortText"
          type="number"
          min={0}
          value={slotChild}
          onChange={(e) => setSlotChild(e.target.value)}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("captureFromPlan")}
          hint={t("captureFromPlanHint")}
          options={[
            { value: "", label: t("captureNone") },
            ...planOptions,
          ]}
          value={capturePlanId}
          onChange={(next) => setCapturePlanId(String(next ?? ""))}
        />
        <ModalFooter
          onCancel={() => setSlotOpen(false)}
          onSubmit={() => void (capturePlanId ? captureFromPlan() : saveSlot())}
          submitLabel={capturePlanId ? t("captureSlot") : t("saveSlot")}
        />
      </ModalShell>
    </div>
  );
}
