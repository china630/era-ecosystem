"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Plus } from "lucide-react";
import { CARD_CLASS } from "@/lib/design-system";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import { ISO_WEEKDAYS } from "@/lib/buffet-week-calendar";

type Template = {
  id: string;
  name: string;
  notes: string | null;
  kind: string;
  active: boolean;
  slots: Array<{
    id: string;
    weekday: number;
    meal: string;
    coversAdult: number;
    coversChild: number;
    lines: Array<{ id: string; menuItemId?: string; name: string; plannedPortions: number }>;
  }>;
};

type Props = {
  outletId: string;
  kindFilter?: "GUEST" | "STAFF";
  /** When create modal picks a different kind, sync chrome filter so the new row is visible. */
  onKindFilterChange?: (kind: "GUEST" | "STAFF") => void;
  planOptions: Array<{ value: string; label: string }>;
  onChromeReady?: (api: { openCreate: () => void }) => void;
  hideInlineChrome?: boolean;
};

export default function BuffetWeekTemplatePanel({
  outletId,
  kindFilter = "GUEST",
  onKindFilterChange,
  planOptions,
  onChromeReady,
  hideInlineChrome = false,
}: Props) {
  const t = useTranslations("admin.buffet");
  const tc = useTranslations("common");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [kindDraft, setKindDraft] = useState<"GUEST" | "STAFF">(kindFilter);
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotWeekday, setSlotWeekday] = useState("1");
  const [slotMeal, setSlotMeal] = useState("BREAKFAST");
  const [slotAdult, setSlotAdult] = useState("0");
  const [slotChild, setSlotChild] = useState("0");
  const [slotDishIds, setSlotDishIds] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<
    Array<{ id: string; label: string; categoryName?: string }>
  >([]);
  const [capturePlanId, setCapturePlanId] = useState("");

  const selected = templates.find((row) => row.id === templateId) ?? null;

  const load = useCallback(() => {
    if (!outletId) {
      setTemplates([]);
      setTemplateId("");
      return;
    }
    const q = new URLSearchParams({
      outletId,
      kind: kindFilter,
    });
    return fetch(`/api/admin/buffet/templates?${q}`)
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
  }, [outletId, kindFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setKindDraft(kindFilter);
  }, [kindFilter]);

  useEffect(() => {
    onChromeReady?.({
      openCreate: () => {
        setNameDraft("");
        setNotesDraft("");
        setKindDraft(kindFilter);
        setCreateOpen(true);
      },
    });
  }, [onChromeReady, kindFilter]);

  async function createTemplate() {
    if (!outletId) return;
    const res = await fetch("/api/admin/buffet/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletId,
        name: nameDraft.trim() || t("defaultTemplateName"),
        notes: notesDraft.trim() || null,
        kind: kindDraft,
        seedSlots: true,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("templateCreateFailed"));
      return;
    }
    showSuccess(t("templateCreated"));
    setCreateOpen(false);
    setNameDraft("");
    setNotesDraft("");
    if (data?.id) {
      setTemplateId(data.id);
      setCompositionOpen(true);
    }
    if (kindDraft !== kindFilter) {
      onKindFilterChange?.(kindDraft);
    } else {
      await load();
    }
  }

  useEffect(() => {
    if (!outletId || !slotOpen) return;
    void fetch(`/api/admin/buffet/menu-items?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
        setMenuItems(
          items.map(
            (row: {
              id: string;
              name?: string;
              plu?: string;
              categoryName?: string;
              label?: string;
            }) => ({
              id: row.id,
              label: row.label || `${row.name ?? ""} (${row.plu ?? ""})`.trim(),
              categoryName: row.categoryName,
            }),
          ),
        );
      })
      .catch(() => undefined);
  }, [outletId, slotOpen]);

  async function saveSlot() {
    if (!templateId) return;
    const res = await fetch(`/api/admin/buffet/templates/${templateId}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekday: Number(slotWeekday),
        meal: slotMeal,
        coversAdult: Number(slotAdult) || 0,
        coversChild: Number(slotChild) || 0,
        menuItemIds: slotDishIds,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("slotSaveFailed"));
      return;
    }
    showSuccess(t("slotSaved"));
    setSlotOpen(false);
    setTemplates((rows) =>
      rows.map((row) => (row.id === templateId ? (data as Template) : row)),
    );
  }

  async function captureFromPlan() {
    if (!templateId || !capturePlanId) {
      showApiError({ error: t("capturePlanRequired") }, t("captureFromPlan"));
      return;
    }
    const res = await fetch(`/api/admin/buffet/templates/${templateId}/capture-from-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: capturePlanId,
        weekday: Number(slotWeekday),
        meal: slotMeal,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("captureFailed"));
      return;
    }
    showSuccess(t("captured"));
    setTemplates((rows) =>
      rows.map((row) => (row.id === templateId ? (data as Template) : row)),
    );
  }

  async function deleteSlot(slotId: string) {
    if (!templateId) return;
    const q = new URLSearchParams({ slotId });
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
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div>
            <p className="m-0 text-sm font-semibold text-[#2C3E50]">{t("templatesListTitle")}</p>
            <p className="m-0 text-xs text-[#7F8C8D]">{t("templateHint")}</p>
          </div>
          {!hideInlineChrome ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!outletId}
              onClick={() => {
                setNameDraft("");
                setNotesDraft("");
                setKindDraft(kindFilter);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1 inline h-4 w-4" />
              {t("newTemplate")}
            </button>
          ) : null}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
            <tr>
              <th className="px-3 py-2 font-medium">{t("templateName")}</th>
              <th className="px-3 py-2 font-medium">{t("kindFilter")}</th>
              <th className="px-3 py-2 font-medium">{t("templateActiveCol")}</th>
              <th className="px-3 py-2 font-medium">{t("templateSlotsCol")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#7F8C8D]">
                  {t("templatesEmpty")}
                </td>
              </tr>
            ) : (
              templates.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer hover:bg-[#F8FAFC] ${
                    row.id === templateId && compositionOpen ? "bg-[#EBF5FB]" : ""
                  }`}
                  onClick={() => {
                    setTemplateId(row.id);
                    setCompositionOpen(true);
                  }}
                >
                  <td className="px-3 py-2 font-medium text-[#2C3E50]">{row.name}</td>
                  <td className="px-3 py-2">
                    {t(`kind.${row.kind === "STAFF" ? "STAFF" : "GUEST"}`)}
                  </td>
                  <td className="px-3 py-2">
                    {row.active ? (
                      <span className="text-[#27AE60]">{t("templateActiveYes")}</span>
                    ) : (
                      <span className="text-[#95A5A6]">{t("templateInactive")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.slots.length}</td>
                  <td className="px-3 py-2 text-right">
                    {!row.active ? (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateId(row.id);
                          void makeTemplateActive();
                        }}
                      >
                        {t("makeActive")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalShell
        open={compositionOpen && !!selected}
        title={selected ? `${t("slotsTitle")} — ${selected.name}` : t("slotsTitle")}
        onClose={() => setCompositionOpen(false)}
        maxWidthClass="max-w-3xl"
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setSlotWeekday("1");
                  setSlotMeal("BREAKFAST");
                  setSlotAdult("0");
                  setSlotChild("0");
                  setSlotDishIds([]);
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
                        setSlotDishIds(
                          slot.lines
                            .map((l) => l.menuItemId)
                            .filter((id): id is string => Boolean(id)),
                        );
                        setCapturePlanId("");
                        setSlotOpen(true);
                      }}
                    >
                      <td className="px-3 py-2">{t(`weekday.${slot.weekday}`)}</td>
                      <td className="px-3 py-2">{t(`meal.${slot.meal}`)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {slot.coversAdult + slot.coversChild}
                      </td>
                      <td className="px-3 py-2">{slot.lines.length}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => void deleteSlot(slot.id)}
                        >
                          {tc("delete")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="m-0 text-xs text-[#95A5A6]">{t("spawnHint")}</p>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={createOpen}
        title={t("newTemplate")}
        onClose={() => setCreateOpen(false)}
      >
        <Field
          label={t("templateName")}
          preset="shortText"
          value={nameDraft}
          placeholder={t("defaultTemplateName")}
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("kindInModal")}
          value={kindDraft}
          options={[
            { value: "GUEST", label: t("kind.GUEST") },
            { value: "STAFF", label: t("kind.STAFF") },
          ]}
          onChange={(next) =>
            setKindDraft(
              (Array.isArray(next) ? next[0] : next) === "STAFF" ? "STAFF" : "GUEST",
            )
          }
        />
        <Field
          label={t("notes")}
          preset="shortText"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setCreateOpen(false)}
          onSubmit={() => void createTemplate()}
          cancelLabel={tc("cancel")}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <ModalShell
        open={slotOpen}
        title={t("editSlot")}
        onClose={() => setSlotOpen(false)}
        overlayZClass="z-[220]"
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colWeekday")}
          value={slotWeekday}
          options={weekdayOptions}
          onChange={(next) => setSlotWeekday(String(next ?? "1"))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colMeal")}
          value={slotMeal}
          options={mealOptions}
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
          kind="MULTI"
          label={t("slotDishes")}
          value={slotDishIds}
          options={menuItems.map((m) => ({ value: m.id, label: m.label }))}
          onChange={(next) =>
            setSlotDishIds(Array.isArray(next) ? next.map(String) : next ? [String(next)] : [])
          }
        />
        {planOptions.length > 0 ? (
          <>
            <CatalogField
              kind="ENTITY_REF"
              label={t("captureFromPlan")}
              hint={t("captureFromPlanHint")}
              value={capturePlanId}
              options={[{ value: "", label: "—" }, ...planOptions]}
              onChange={(next) => setCapturePlanId(String(next ?? ""))}
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void captureFromPlan()}
            >
              {t("captureFromPlan")}
            </button>
          </>
        ) : null}
        <ModalFooter
          onCancel={() => setSlotOpen(false)}
          onSubmit={() => void saveSlot()}
          cancelLabel={tc("cancel")}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </div>
  );
}
