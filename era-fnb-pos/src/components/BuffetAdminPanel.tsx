"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import {
  CatalogField,
  type CatalogFieldKind,
  Field,
  FieldRow,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { ClipboardList, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { CARD_CLASS } from "@/lib/design-system";
import BuffetWeekTemplatePanel from "@/components/BuffetWeekTemplatePanel";
import BuffetManagementMealsPanel from "@/components/BuffetManagementMealsPanel";
import BuffetStaffMealsPanel from "@/components/BuffetStaffMealsPanel";
import BuffetCostRunPanel from "@/components/BuffetCostRunPanel";
import BuffetForecastPanel from "@/components/BuffetForecastPanel";
import BuffetPageChrome from "@/components/BuffetPageChrome";

type Outlet = {
  id: string;
  code: string;
  name: string;
  capBuffetPlanner?: boolean;
};
type PlanRow = {
  id: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  serviceDate: string;
  meal: string;
  status: string;
  coversAdult: number;
  coversChild: number;
  coversTotal: number;
  coversSource: string;
  notes: string | null;
  lineCount: number;
  portionsSum: number;
  stations: string[];
  missingBomCount: number;
  lines: PlanLine[];
};
type PlanLine = {
  id: string;
  menuItemId: string;
  station: string;
  plannedPortions: number;
  wastePct: number;
  name: string;
  plu: string;
  recipeSku: string | null;
  categoryName: string;
};
type MenuOption = { id: string; label: string; name: string; plu: string };

type PlanForm = {
  outletId: string;
  serviceDate: string;
  meal: string;
  coversAdult: string;
  coversChild: string;
  notes: string;
};

type LineForm = {
  menuItemId: string;
  station: string;
  plannedPortions: string;
  wastePct: string;
};

function addCivilDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

const emptyPlanForm = (outletId: string): PlanForm => ({
  outletId,
  serviceDate: todayBakuYmd(),
  meal: "BREAKFAST",
  coversAdult: "0",
  coversChild: "0",
  notes: "",
});

const emptyLineForm = (): LineForm => ({
  menuItemId: "",
  station: "MAIN",
  plannedPortions: "1",
  wastePct: "0",
});

export type BuffetSection =
  | "plans"
  | "templates"
  | "management"
  | "costRun"
  | "forecast"
  | "norms";

export default function BuffetAdminPanel({
  section = "plans",
}: {
  section?: BuffetSection;
}) {
  const t = useTranslations("admin.buffet");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");

  const today = todayBakuYmd();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(() => addCivilDays(today, 6));
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"GUEST" | "STAFF" | "">("GUEST");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [planModal, setPlanModal] = useState<"create" | "edit" | "copy" | null>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [spawnTemplateId, setSpawnTemplateId] = useState("");
  const [spawnWeekStart, setSpawnWeekStart] = useState(() => today);
  const [spawnCoversSource, setSpawnCoversSource] = useState<"MANUAL" | "HOTEL">("MANUAL");
  const [spawnAdult, setSpawnAdult] = useState("0");
  const [spawnChild, setSpawnChild] = useState("0");
  const [spawnFactor, setSpawnFactor] = useState("80");
  const [templatesForSpawn, setTemplatesForSpawn] = useState<
    Array<{ id: string; name: string; active: boolean }>
  >([]);
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm(""));
  const [lineModal, setLineModal] = useState<"create" | "edit" | null>(null);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLineForm());
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const viewTab = section;
  const [coversRollup, setCoversRollup] = useState<{
    forecastTotal: number;
    management: { count: number };
    staff: { coversStaff: number };
    plan: { coversTotal: number } | null;
    hotel: { guestNights: number; source: string } | null;
  } | null>(null);
  const [rollupNonce, setRollupNonce] = useState(0);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const tmplChromeRef = useRef<{ openCreate: () => void } | null>(null);
  const mgmtChromeRef = useRef<{
    openRoster: () => void;
    openSignToday: () => void;
  } | null>(null);
  const forecastChromeRef = useRef<{
    syncHotel: () => void;
    saveNorms: () => void;
    saving: boolean;
    loading: boolean;
  } | null>(null);
  const costChromeRef = useRef<{
    refresh: () => void;
    financeHref: string | null;
    loading: boolean;
    toggleStaffOverride: () => void;
    staffOverrideOpen: boolean;
  } | null>(null);
  const [chromeTick, setChromeTick] = useState(0);
  const bumpChrome = useCallback(() => setChromeTick((n) => n + 1), []);
  const [materials, setMaterials] = useState<{
    missingBomCount: number;
    rows: Array<{
      name: string;
      station: string;
      effectivePortions: number;
      recipeSku: string | null;
      warning: string | null;
    }>;
  } | null>(null);
  const [buffetModuleActive, setBuffetModuleActive] = useState<boolean | null>(null);
  const [outletCostModel, setOutletCostModel] = useState<string | null>(null);

  const selected = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [plans, selectedId],
  );

  const mealOptions = useMemo(
    () =>
      (["BREAKFAST", "LUNCH", "DINNER"] as const).map((m) => ({
        value: m,
        label: t(`meal.${m}`),
      })),
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: tc("all") },
      ...(["DRAFT", "LOCKED", "SERVED", "CLOSED"] as const).map((s) => ({
        value: s,
        label: t(`status.${s}`),
      })),
    ],
    [t, tc],
  );

  const outletOptions = useMemo(
    () => outlets.map((o) => ({ value: o.id, label: `${o.code} — ${o.name}` })),
    [outlets],
  );

  const stationOptions = useMemo(
    () =>
      (["MAIN", "HOT", "COLD", "SOUP", "BAKERY", "DRINKS"] as const).map((s) => ({
        value: s,
        label: t(`station.${s}`),
      })),
    [t],
  );

  const loadOutlets = useCallback(async () => {
    const res = await fetch("/api/outlets");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("loadFailed"));
      return;
    }
    const raw = Array.isArray(data?.outlets) ? (data.outlets as Outlet[]) : [];
    const list =
      raw.some((o) => o.capBuffetPlanner === true)
        ? raw.filter((o) => o.capBuffetPlanner === true)
        : raw;
    setOutlets(list);
    if (!outletId && list.length > 0) {
      // Prefer buffet twin NAFTANI over lab KAFE/café so chef path does not land on café.
      const preferred =
        list.find((o) => o.code.trim().toUpperCase() === "NAFTANI") ??
        list.find((o) => !/^(KAFE|CAFE)$/i.test(o.code.trim())) ??
        list[0];
      setOutletId(preferred.id);
    }
  }, [outletId, t]);

  const loadPlans = useCallback(async () => {
    const qs = new URLSearchParams();
    if (outletId) qs.set("outletId", outletId);
    if (fromDate) qs.set("from", fromDate);
    if (toDate) qs.set("to", toDate);
    if (statusFilter) qs.set("status", statusFilter);
    const res = await fetch(`/api/admin/buffet/plans?${qs}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("loadFailed"));
      return;
    }
    const list = Array.isArray(data?.plans) ? (data.plans as PlanRow[]) : [];
    setPlans(list);
    if (selectedId && !list.some((p) => p.id === selectedId)) {
      setSelectedId(null);
      setCompositionOpen(false);
    }
  }, [outletId, fromDate, toDate, statusFilter, selectedId, t]);

  const loadMenuItems = useCallback(
    async (oid: string) => {
      if (!oid) {
        setMenuOptions([]);
        return;
      }
      const res = await fetch(`/api/admin/buffet/menu-items?outletId=${encodeURIComponent(oid)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(data, t("loadFailed"));
        return;
      }
      setMenuOptions(Array.isArray(data?.items) ? data.items : []);
    },
    [t],
  );

  useEffect(() => {
    void loadOutlets();
  }, [loadOutlets]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        const body = (data?.data ?? data) as { activeModules?: string[] } | null;
        const mods = Array.isArray(body?.activeModules) ? body!.activeModules! : [];
        setBuffetModuleActive(mods.includes("fnb_buffet_planner"));
      })
      .catch(() => setBuffetModuleActive(null));
  }, []);

  useEffect(() => {
    if (!outletId) {
      setOutletCostModel(null);
      return;
    }
    void fetch("/api/settings/buffet-cost")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        const body = (data?.data ?? data) as {
          orgDefaults?: { buffetCostModel?: string };
          outletOverrides?: Record<string, { buffetCostModel?: string }>;
        } | null;
        if (!body) {
          setOutletCostModel(null);
          return;
        }
        const model =
          body.outletOverrides?.[outletId]?.buffetCostModel ??
          body.orgDefaults?.buffetCostModel ??
          null;
        setOutletCostModel(model);
      })
      .catch(() => setOutletCostModel(null));
  }, [outletId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (selected && compositionOpen) void loadMenuItems(selected.outletId);
  }, [selected, compositionOpen, loadMenuItems]);

  useEffect(() => {
    if (!selected) {
      setCoversRollup(null);
      return;
    }
    // Refetch when composition reopens or management meals change (rollupNonce).
    const q = new URLSearchParams({
      outletId: selected.outletId,
      date: selected.serviceDate,
      meal: selected.meal,
    });
    void fetch(`/api/admin/buffet/covers-rollup?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.forecastTotal === "number") {
          setCoversRollup({
            forecastTotal: d.forecastTotal,
            management: { count: d.management?.count ?? 0 },
            staff: { coversStaff: d.staff?.coversStaff ?? 0 },
            plan: d.plan ?? null,
            hotel:
              d.hotel && typeof d.hotel.guestNights === "number"
                ? { guestNights: d.hotel.guestNights, source: String(d.hotel.source ?? "MANUAL") }
                : null,
          });
        } else {
          setCoversRollup(null);
        }
      })
      .catch(() => setCoversRollup(null));
  }, [selected, compositionOpen, rollupNonce]);

  function openCreatePlan() {
    setPlanForm(emptyPlanForm(outletId));
    setPlanModal("create");
  }

  function openEditPlan(row: PlanRow) {
    setPlanForm({
      outletId: row.outletId,
      serviceDate: row.serviceDate,
      meal: row.meal,
      coversAdult: String(row.coversAdult),
      coversChild: String(row.coversChild),
      notes: row.notes ?? "",
    });
    setSelectedId(row.id);
    setPlanModal("edit");
  }

  function openComposition(row: PlanRow) {
    setSelectedId(row.id);
    setCompositionOpen(true);
  }

  function openCopyRetry(row: PlanRow, serviceDate: string) {
    setCompositionOpen(false);
    setCopySourceId(row.id);
    setPlanForm({
      outletId: row.outletId,
      serviceDate,
      meal: row.meal,
      coversAdult: String(row.coversAdult),
      coversChild: String(row.coversChild),
      notes: row.notes ?? "",
    });
    setPlanModal("copy");
  }

  async function copyPlan(row: PlanRow, serviceDate = todayBakuYmd()) {
    setCompositionOpen(false);
    const res = await fetch(`/api/admin/buffet/plans/${row.id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceDate }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.code === "PLAN_SLOT_TAKEN" || res.status === 409) {
        showApiError(data, t("copySlotTaken"));
        openCopyRetry(row, serviceDate);
        return;
      }
      showApiError(data, t("copyFailed"));
      return;
    }
    showSuccess(t("copied"));
    setCopySourceId(null);
    await loadPlans();
    if (data?.id) {
      openEditPlan({
        ...row,
        id: data.id,
        serviceDate: data.serviceDate ?? serviceDate,
        meal: data.meal ?? row.meal,
        status: "DRAFT",
        coversAdult: data.coversAdult ?? row.coversAdult,
        coversChild: data.coversChild ?? row.coversChild,
        notes: data.notes ?? row.notes,
        lineCount: data.lineCount ?? row.lineCount,
        portionsSum: data.portionsSum ?? row.portionsSum,
        stations: data.stations ?? row.stations,
        missingBomCount: data.missingBomCount ?? row.missingBomCount,
        lines: data.lines ?? [],
      });
    }
  }

  async function savePlan() {
    if (planModal === "create" && !planForm.outletId.trim()) {
      showApiError({ error: t("outletRequired") }, t("saveFailed"));
      return;
    }
    if (planModal === "copy") {
      if (!copySourceId) {
        showApiError({ error: t("copyFailed") }, t("saveFailed"));
        return;
      }
      const source = plans.find((p) => p.id === copySourceId);
      if (!source) {
        showApiError({ error: t("copyFailed") }, t("saveFailed"));
        return;
      }
      const res = await fetch(`/api/admin/buffet/plans/${copySourceId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceDate: planForm.serviceDate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(data, data?.code === "PLAN_SLOT_TAKEN" ? t("copySlotTaken") : t("copyFailed"));
        return;
      }
      showSuccess(t("copied"));
      setPlanModal(null);
      setCopySourceId(null);
      await loadPlans();
      if (data?.id) {
        const coversAdult = Number(planForm.coversAdult) || 0;
        const coversChild = Number(planForm.coversChild) || 0;
        const patch = await fetch(`/api/admin/buffet/plans/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coversAdult,
            coversChild,
            notes: planForm.notes.trim() || null,
          }),
        });
        if (patch.ok) await loadPlans();
        openEditPlan({
          ...source,
          id: data.id,
          serviceDate: data.serviceDate ?? planForm.serviceDate,
          meal: data.meal ?? planForm.meal,
          status: "DRAFT",
          coversAdult,
          coversChild,
          notes: planForm.notes.trim() || null,
          lineCount: data.lineCount ?? source.lineCount,
          portionsSum: data.portionsSum ?? source.portionsSum,
          stations: data.stations ?? source.stations,
          missingBomCount: data.missingBomCount ?? source.missingBomCount,
          lines: data.lines ?? [],
        });
      }
      return;
    }
    const payload = {
      outletId: planForm.outletId,
      serviceDate: planForm.serviceDate,
      meal: planForm.meal,
      coversAdult: Number(planForm.coversAdult) || 0,
      coversChild: Number(planForm.coversChild) || 0,
      coversSource: "MANUAL" as const,
      notes: planForm.notes.trim() || null,
    };
    const res =
      planModal === "create"
        ? await fetch("/api/admin/buffet/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/buffet/plans/${selectedId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serviceDate: payload.serviceDate,
              meal: payload.meal,
              coversAdult: payload.coversAdult,
              coversChild: payload.coversChild,
              notes: payload.notes,
            }),
          });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setPlanModal(null);
    setCopySourceId(null);
    if (data?.id) setSelectedId(data.id);
    await loadPlans();
  }

  function openCreateLine() {
    setLineForm(emptyLineForm());
    setLineModal("create");
  }

  function openEditLine(line: PlanLine) {
    setLineForm({
      menuItemId: line.menuItemId,
      station: line.station,
      plannedPortions: String(line.plannedPortions),
      wastePct: String(line.wastePct),
    });
    setLineModal("edit");
  }

  async function setStatus(status: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/buffet/plans/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    await loadPlans();
  }

  async function saveLine() {
    if (!selectedId) return;
    if (!lineForm.menuItemId.trim()) {
      showApiError({ error: t("dishRequired") }, t("saveFailed"));
      return;
    }
    const portions = Number(lineForm.plannedPortions);
    if (!Number.isFinite(portions) || portions < 1) {
      showApiError({ error: t("portionsRequired") }, t("saveFailed"));
      return;
    }
    const res = await fetch(`/api/admin/buffet/plans/${selectedId}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menuItemId: lineForm.menuItemId,
        station: lineForm.station,
        plannedPortions: portions,
        wastePct: Number(lineForm.wastePct) || 0,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setLineModal(null);
    setLineForm(emptyLineForm());
    await loadPlans();
  }

  async function removeLine(lineId: string) {
    if (!confirm(t("confirmDeleteLine"))) return;
    const res = await fetch(`/api/admin/buffet/lines/${lineId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    await loadPlans();
  }

  async function openMaterials() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/buffet/plans/${selectedId}/materials`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("loadFailed"));
      return;
    }
    setMaterials(data);
    setMaterialsOpen(true);
  }

  async function publishDaily() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/buffet/plans/${selectedId}/publish-daily-menu`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("publishFailed"));
      return;
    }
    showSuccess(t("published", { count: data.count ?? 0 }));
  }

  async function copyLinesFromLast() {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/buffet/plans/${selectedId}/copy-lines-from-last`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("copyLinesFailed"));
      return;
    }
    showSuccess(t("copiedLines"));
    await loadPlans();
  }

  const planCaptureOptions = useMemo(
    () =>
      plans.map((p) => ({
        value: p.id,
        label: `${bakuDateDisplay(String(p.serviceDate).slice(0, 10))} · ${t(`meal.${p.meal}`)} · ${p.coversTotal}`,
      })),
    [plans, t],
  );

  const sectionTitle =
    viewTab === "templates"
      ? tn("buffetTemplates")
      : viewTab === "management"
        ? tn("buffetManagement")
        : viewTab === "forecast"
          ? tn("buffetForecast")
          : viewTab === "norms"
            ? tn("buffetNorms")
            : viewTab === "costRun"
              ? tn("buffetCostRun")
              : tn("buffetPlans");
  const sectionSubtitle =
    viewTab === "plans"
      ? t("plansHierarchyHint")
      : viewTab === "templates"
        ? t("templatesChromeHint")
        : viewTab === "management"
          ? t("managementHint")
          : viewTab === "forecast"
            ? t("forecastHint")
            : viewTab === "norms"
              ? t("normsHint")
              : viewTab === "costRun"
                ? t("costRunHint")
                : t("subtitle");

  const headerActions = (void chromeTick,
    viewTab === "plans" ? (
      <>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => {
            const spawnKind = kindFilter === "STAFF" ? "STAFF" : "GUEST";
            if (spawnKind === "STAFF") setSpawnCoversSource("MANUAL");
            setSpawnOpen(true);
            void fetch(
              `/api/admin/buffet/templates?outletId=${encodeURIComponent(outletId)}&kind=${spawnKind}`,
            )
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                const rows = Array.isArray(d?.templates) ? d.templates : [];
                setTemplatesForSpawn(rows);
                const active = rows.find((r: { active: boolean }) => r.active);
                setSpawnTemplateId(active?.id || rows[0]?.id || "");
              })
              .catch(() => undefined);
            void fetch("/api/settings/buffet-cost")
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                const org = d?.settings?.orgDefaults;
                const pct =
                  spawnKind === "STAFF"
                    ? (org?.productionFactorPctStaff ?? 100)
                    : (org?.productionFactorPctGuest ?? 80);
                setSpawnFactor(String(pct));
              })
              .catch(() => undefined);
          }}
        >
          {t("spawnWeek")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => openCreatePlan()}
        >
          <Plus className="mr-1 inline h-4 w-4" />
          {t("newPlan")}
        </button>
      </>
    ) : viewTab === "templates" ? (
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={!outletId || !tmplChromeRef.current}
        onClick={() => tmplChromeRef.current?.openCreate()}
      >
        <Plus className="mr-1 inline h-4 w-4" />
        {t("newTemplate")}
      </button>
    ) : viewTab === "management" ? (
      <>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={!outletId || !mgmtChromeRef.current}
          onClick={() => mgmtChromeRef.current?.openRoster()}
        >
          {t("eatersRoster")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={!outletId || !mgmtChromeRef.current}
          onClick={() => mgmtChromeRef.current?.openSignToday()}
        >
          {t("signManagementToday")}
        </button>
      </>
    ) : viewTab === "forecast" ? (
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={
          !forecastChromeRef.current ||
          forecastChromeRef.current.loading ||
          !fromDate ||
          !toDate
        }
        onClick={() => forecastChromeRef.current?.syncHotel()}
      >
        {t("forecastSyncHotel")}
      </button>
    ) : viewTab === "norms" ? (
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={!forecastChromeRef.current || forecastChromeRef.current.saving}
        onClick={() => forecastChromeRef.current?.saveNorms()}
      >
        {forecastChromeRef.current?.saving ? "…" : t("forecastSaveNorms")}
      </button>
    ) : viewTab === "costRun" ? (
      <>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={
            !outletId ||
            !costChromeRef.current ||
            costChromeRef.current.loading
          }
          onClick={() => costChromeRef.current?.refresh()}
        >
          {costChromeRef.current?.loading ? "…" : t("costRunRefresh")}
        </button>
        {costChromeRef.current?.financeHref ? (
          <a
            href={costChromeRef.current.financeHref}
            className={SECONDARY_BUTTON_CLASS}
            target="_blank"
            rel="noreferrer"
          >
            {t("costRunOpenFinance")}
          </a>
        ) : null}
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={!costChromeRef.current}
          onClick={() => costChromeRef.current?.toggleStaffOverride()}
        >
          {costChromeRef.current?.staffOverrideOpen
            ? t("costRunStaffOverrideHide")
            : t("costRunStaffOverrideShow")}
        </button>
      </>
    ) : null);

  return (
    <div className="space-y-4">
      <PageHeader title={sectionTitle} subtitle={sectionSubtitle} actions={headerActions} />

      {buffetModuleActive === false ? (
        <div className={`${CARD_CLASS} border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950`}>
          <p className="m-0 font-medium">{t("moduleMissingTitle")}</p>
          <p className="mt-1 m-0 text-amber-900">{t("moduleMissingBody")}</p>
          <Link href="/admin/settings" className="mt-2 inline-block text-[#2980B9] underline">
            {t("moduleMissingSyncLink")}
          </Link>
        </div>
      ) : null}

      {outlets.length === 0 ? (
        <div className={`${CARD_CLASS} p-4 text-sm text-[#7F8C8D]`}>
          {t("noOutlets")}{" "}
          <Link href="/admin/settings" className="text-[#2980B9] underline">
            {t("manageOutletsLink")}
          </Link>
        </div>
      ) : null}

      <BuffetPageChrome
        outlets={outlets}
        outletId={outletId}
        onOutletChange={setOutletId}
        showDates={viewTab !== "templates"}
        fromDate={fromDate}
        toDate={toDate}
        onFromDate={setFromDate}
        onToDate={setToDate}
        showKind={viewTab === "plans" || viewTab === "templates"}
        kindFilter={kindFilter === "STAFF" ? "STAFF" : "GUEST"}
        onKindFilter={(k) => setKindFilter(k)}
        showStatus={viewTab === "plans"}
        statusFilter={statusFilter}
        statusOptions={statusOptions}
        onStatusFilter={setStatusFilter}
        banner={
          outletCostModel && outletCostModel !== "HYBRID" ? (
            <p className="m-0 text-xs text-[#E67E22]">
              {outletCostModel === "OFF"
                ? t("outletModelOffBanner")
                : t("outletModelLabel", { model: outletCostModel })}
            </p>
          ) : null
        }
      />

      {viewTab === "templates" ? (
        <BuffetWeekTemplatePanel
          outletId={outletId}
          kindFilter={kindFilter === "STAFF" ? "STAFF" : "GUEST"}
          onKindFilterChange={(k) => setKindFilter(k)}
          planOptions={planCaptureOptions}
          onChromeReady={(api) => {
            const first = !tmplChromeRef.current;
            tmplChromeRef.current = api;
            if (first) bumpChrome();
          }}
          hideInlineChrome
        />
      ) : null}

      {viewTab === "management" ? (
        <BuffetManagementMealsPanel
          outletId={outletId}
          fromDate={fromDate}
          toDate={toDate}
          onChanged={() => setRollupNonce((n) => n + 1)}
          onChromeReady={(api) => {
            const first = !mgmtChromeRef.current;
            mgmtChromeRef.current = api;
            if (first) bumpChrome();
          }}
          hideInlineChrome
        />
      ) : null}

      {viewTab === "plans" && kindFilter === "STAFF" ? (
        <BuffetStaffMealsPanel
          outletId={outletId}
          onChanged={() => setRollupNonce((n) => n + 1)}
        />
      ) : null}

      {viewTab === "costRun" ? (
        <BuffetCostRunPanel
          outletId={outletId}
          fromDate={fromDate}
          toDate={toDate}
          onGoForecast={() => {
            window.location.href = "/admin/buffet/norms";
          }}
          onGoGuestNights={() => {
            window.location.href = "/admin/buffet/forecast";
          }}
          onChromeReady={(api) => {
            const prev = costChromeRef.current;
            costChromeRef.current = api;
            if (
              !prev ||
              prev.loading !== api.loading ||
              prev.financeHref !== api.financeHref ||
              prev.staffOverrideOpen !== api.staffOverrideOpen
            ) {
              bumpChrome();
            }
          }}
          hideInlineChrome
        />
      ) : null}

      {viewTab === "forecast" ? (
        <BuffetForecastPanel
          outletId={outletId}
          fromDate={fromDate}
          toDate={toDate}
          mode="nights"
          onChromeReady={(api) => {
            const prev = forecastChromeRef.current;
            forecastChromeRef.current = api;
            if (!prev || prev.loading !== api.loading || prev.saving !== api.saving) {
              bumpChrome();
            }
          }}
          hideInlineChrome
        />
      ) : null}

      {viewTab === "norms" ? (
        <BuffetForecastPanel
          outletId={outletId}
          fromDate={fromDate}
          toDate={toDate}
          mode="norms"
          onChromeReady={(api) => {
            const prev = forecastChromeRef.current;
            forecastChromeRef.current = api;
            if (!prev || prev.loading !== api.loading || prev.saving !== api.saving) {
              bumpChrome();
            }
          }}
          hideInlineChrome
        />
      ) : null}

      {viewTab === "plans" && kindFilter !== "STAFF" ? (
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="border-b px-3 py-2 text-sm font-semibold text-[#2C3E50]">{t("plansTitle")}</div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#F8FAFC] text-[#7F8C8D]">
              <tr>
                <th className="px-3 py-2 font-medium">{t("colDate")}</th>
                <th className="px-3 py-2 font-medium">{t("colMeal")}</th>
                <th className="px-3 py-2 font-medium">{t("colCovers")}</th>
                <th className="px-3 py-2 font-medium">{t("colStatus")}</th>
                <th className="px-3 py-2 font-medium">{t("colLines")}</th>
                <th className="px-3 py-2 font-medium">{t("colStations")}</th>
                <th className="px-3 py-2 font-medium">{t("colBom")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[#7F8C8D]">
                    {t("emptyPlans")}
                  </td>
                </tr>
              ) : (
                plans.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer hover:bg-[#F8FAFC] ${selectedId === row.id && compositionOpen ? "bg-[#EBF5FB]" : ""}`}
                    onDoubleClick={() => openComposition(row)}
                  >
                    <td className="px-3 py-2">{bakuDateDisplay(String(row.serviceDate).slice(0, 10))}</td>
                    <td className="px-3 py-2">{t(`meal.${row.meal}`)}</td>
                    <td className="px-3 py-2 tabular-nums" title={t("coversLabel", { adult: row.coversAdult, child: row.coversChild })}>
                      {row.coversTotal}{" "}
                      <span className="text-xs text-[#7F8C8D]">
                        ({row.coversAdult}/{row.coversChild})
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-[#ECF0F1] px-2 py-0.5 text-xs font-medium text-[#2C3E50]">
                        {t(`status.${row.status}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {t("linesSummary", { count: row.lineCount, portions: row.portionsSum ?? 0 })}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#566573]">
                      {(row.stations ?? [])
                        .map((s) => stationOptions.find((o) => o.value === s)?.label ?? s)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {(row.missingBomCount ?? 0) > 0 ? (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E67E22]" title={t("bomHint", { missing: row.missingBomCount })} />
                      ) : (
                        <span className="text-[#BDC3C7]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 text-[#2980B9]"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPlan(row);
                          }}
                          aria-label={tc("edit")}
                          title={tc("edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-[#2980B9]"
                          onClick={(e) => {
                            e.stopPropagation();
                            openComposition(row);
                          }}
                          aria-label={t("openComposition")}
                          title={t("openComposition")}
                        >
                          <ClipboardList className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-[#2980B9]"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyPlan(row);
                          }}
                          aria-label={t("copyPlan")}
                          title={t("copyPlan")}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      <ModalShell
        open={compositionOpen && selected != null}
        onClose={() => setCompositionOpen(false)}
        title={
          selected
            ? `${selected.outletName} · ${t(`meal.${selected.meal}`)} · ${bakuDateDisplay(String(selected.serviceDate).slice(0, 10))}`
            : t("openComposition")
        }
      >
        {selected ? (
          <div className="space-y-3">
            <p className="text-sm text-[#7F8C8D]">
              {t("coversLabel", {
                adult: selected.coversAdult,
                child: selected.coversChild,
              })}{" "}
              · {t(`status.${selected.status}`)}
            </p>
            {coversRollup ? (
              <div className={`${CARD_CLASS} space-y-2 p-3`}>
                <div className="text-sm font-semibold text-[#2C3E50]">{t("rollupCardTitle")}</div>
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7F8C8D]">{t("rollupPlanCovers")}</dt>
                    <dd className="tabular-nums">
                      {(selected.coversAdult ?? 0) + (selected.coversChild ?? 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7F8C8D]">{t("rollupManagement")}</dt>
                    <dd className="tabular-nums">{coversRollup.management.count}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7F8C8D]">{t("rollupStaff")}</dt>
                    <dd className="tabular-nums">{coversRollup.staff.coversStaff}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7F8C8D]">{t("rollupForecastTotal")}</dt>
                    <dd className="tabular-nums font-medium">{coversRollup.forecastTotal}</dd>
                  </div>
                  {coversRollup.hotel ? (
                    <div className="flex justify-between gap-2 sm:col-span-2">
                      <dt className="text-[#7F8C8D]">{t("rollupHotelNights")}</dt>
                      <dd className="tabular-nums">
                        {coversRollup.hotel.guestNights} ({coversRollup.hotel.source})
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="m-0 text-xs text-[#95A5A6]">{t("rollupCaption")}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {selected.status === "DRAFT" ? (
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus("LOCKED")}>
                  {t("lock")}
                </button>
              ) : null}
              {selected.status === "LOCKED" ? (
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus("SERVED")}>
                  {t("markServed")}
                </button>
              ) : null}
              {selected.status === "SERVED" ? (
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus("CLOSED")}>
                  {t("closePlan")}
                </button>
              ) : null}
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={selected.lineCount === 0}
                onClick={() => void openMaterials()}
              >
                {t("materials")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={selected.lineCount === 0}
                onClick={() => void publishDaily()}
              >
                {t("publishDaily")}
              </button>
              {selected.status === "DRAFT" ? (
                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => openCreateLine()}>
                  <Plus className="mr-1 inline h-4 w-4" />
                  {t("addLine")}
                </button>
              ) : null}
            </div>

            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
                  <tr>
                    <th className="px-2 py-2 font-medium">{t("colStation")}</th>
                    <th className="px-2 py-2 font-medium">{t("colDish")}</th>
                    <th className="px-2 py-2 font-medium">{t("colPortions")}</th>
                    <th className="px-2 py-2 font-medium">{t("colWaste")}</th>
                    <th className="px-2 py-2 font-medium">{t("colRecipe")}</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selected.lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-[#7F8C8D]">
                        <p>{t("emptyLines")}</p>
                        {selected.status === "DRAFT" ? (
                          <button
                            type="button"
                            className={`${SECONDARY_BUTTON_CLASS} mt-2`}
                            onClick={() => void copyLinesFromLast()}
                          >
                            {t("copyLinesFromLast")}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ) : (
                    selected.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-2 py-2">
                          {stationOptions.find((s) => s.value === line.station)?.label ?? line.station}
                        </td>
                        <td className="px-2 py-2">
                          <div>{line.name}</div>
                          <div className="text-xs text-[#7F8C8D]">
                            {line.categoryName} · {line.plu}
                          </div>
                        </td>
                        <td className="px-2 py-2 tabular-nums">{line.plannedPortions}</td>
                        <td className="px-2 py-2 tabular-nums">{line.wastePct}%</td>
                        <td className="px-2 py-2 text-xs">{line.recipeSku || "—"}</td>
                        <td className="px-2 py-2 text-right">
                          {selected.status === "DRAFT" ? (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="rounded p-1 text-[#2980B9]"
                                onClick={() => openEditLine(line)}
                                aria-label={tc("edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-[#C0392B]"
                                onClick={() => void removeLine(line.id)}
                                aria-label={tc("delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <ModalFooter
          onCancel={() => setCompositionOpen(false)}
          onSubmit={() => setCompositionOpen(false)}
          cancelLabel={tc("cancel")}
          submitLabel={tc("close")}
        />
      </ModalShell>

      <ModalShell
        open={spawnOpen}
        onClose={() => setSpawnOpen(false)}
        title={t("spawnWeek")}
      >
        <div className="space-y-3">
          <CatalogField
            kind={"ENTITY_REF" as CatalogFieldKind}
            label={t("template")}
            value={spawnTemplateId}
            options={templatesForSpawn.map((r) => ({
              value: r.id,
              label: `${r.name}${r.active ? "" : ` (${t("templateInactive")})`}`,
            }))}
            onChange={(next) =>
              setSpawnTemplateId(Array.isArray(next) ? next[0] ?? "" : next)
            }
          />
          <Field
            label={t("weekStart")}
            preset="date"
            type="date"
            value={spawnWeekStart}
            onChange={(e) => setSpawnWeekStart(e.target.value)}
          />
          {kindFilter !== "STAFF" ? (
            <CatalogField
              kind={"CLOSED_SMALL" as CatalogFieldKind}
              label={t("coversSource")}
              value={spawnCoversSource}
              options={[
                { value: "MANUAL", label: t("coversSourceManual") },
                { value: "HOTEL", label: t("coversSourceHotel") },
              ]}
              onChange={(next) =>
                setSpawnCoversSource(
                  (Array.isArray(next) ? next[0] : next) === "HOTEL" ? "HOTEL" : "MANUAL",
                )
              }
            />
          ) : null}
          {spawnCoversSource === "MANUAL" || kindFilter === "STAFF" ? (
            <FieldRow cols={2}>
              <Field
                label={t("coversAdult")}
                preset="shortText"
                inputMode="numeric"
                value={spawnAdult}
                onChange={(e) => setSpawnAdult(e.target.value)}
              />
              <Field
                label={t("coversChild")}
                preset="shortText"
                inputMode="numeric"
                value={spawnChild}
                onChange={(e) => setSpawnChild(e.target.value)}
              />
            </FieldRow>
          ) : null}
          <Field
            label={t("productionFactorPct")}
            preset="shortText"
            inputMode="numeric"
            value={spawnFactor}
            onChange={(e) => setSpawnFactor(e.target.value)}
          />
        </div>
        <ModalFooter
          onCancel={() => setSpawnOpen(false)}
          onSubmit={() => {
            void (async () => {
              if (!spawnTemplateId) return;
              const effectiveSource =
                kindFilter === "STAFF" ? "MANUAL" : spawnCoversSource;
              if (effectiveSource === "HOTEL") {
                await fetch("/api/admin/buffet/guest-nights/sync-hotel", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: spawnWeekStart,
                    to: addCivilDays(spawnWeekStart, 6),
                    outletId: outletId || null,
                  }),
                }).catch(() => undefined);
              }
              const factorDefault = kindFilter === "STAFF" ? 100 : 80;
              const res = await fetch(
                `/api/admin/buffet/templates/${spawnTemplateId}/spawn`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    weekStart: spawnWeekStart,
                    coversSource: effectiveSource,
                    coversAdult:
                      effectiveSource === "MANUAL" ? Number(spawnAdult) || 0 : undefined,
                    coversChild:
                      effectiveSource === "MANUAL" ? Number(spawnChild) || 0 : undefined,
                    productionFactorPct: Number(spawnFactor) || factorDefault,
                  }),
                },
              );
              const data = await res.json().catch(() => null);
              if (!res.ok) {
                showApiError(data, t("spawnFailed"));
                return;
              }
              if (data?.emptySlots > 0) {
                showSuccess(t("spawnedWithEmpty", { empty: data.emptySlots }));
              } else {
                showSuccess(t("spawned", { created: data?.created?.length ?? 0, skipped: data?.skipped?.length ?? 0 }));
              }
              setSpawnOpen(false);
              await loadPlans();
            })();
          }}
          submitLabel={t("spawnWeek")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>

      <ModalShell
        open={planModal != null}
        onClose={() => {
          setPlanModal(null);
          setCopySourceId(null);
        }}
        title={
          planModal === "create"
            ? t("newPlan")
            : planModal === "copy"
              ? t("copyPlan")
              : t("editPlan")
        }
      >
        <div className="space-y-3">
          {planModal === "create" ? (
            <CatalogField
              kind={"ENTITY_REF" as CatalogFieldKind}
              label={t("outlet")}
              value={planForm.outletId}
              options={outletOptions}
              onChange={(next) =>
                setPlanForm((f) => ({
                  ...f,
                  outletId: Array.isArray(next) ? next[0] ?? "" : next,
                }))
              }
            />
          ) : null}
          {planModal === "copy" ? (
            <p className="text-sm text-[#7F8C8D]">{t("copyRetryHint")}</p>
          ) : null}
          <Field
            label={t("serviceDate")}
            preset="date"
            type="date"
            value={planForm.serviceDate}
            onChange={(e) => setPlanForm((f) => ({ ...f, serviceDate: e.target.value }))}
          />
          <CatalogField
            kind={"CLOSED_SMALL" as CatalogFieldKind}
            label={t("mealLabel")}
            value={planForm.meal}
            options={mealOptions}
            onChange={(next) =>
              setPlanForm((f) => ({
                ...f,
                meal: Array.isArray(next) ? next[0] ?? "BREAKFAST" : next,
              }))
            }
            disabled={planModal === "copy"}
          />
          <FieldRow cols={2}>
            <Field
              label={t("coversAdult")}
              preset="shortText"
              inputMode="numeric"
              value={planForm.coversAdult}
              onChange={(e) => setPlanForm((f) => ({ ...f, coversAdult: e.target.value }))}
            />
            <Field
              label={t("coversChild")}
              preset="shortText"
              inputMode="numeric"
              value={planForm.coversChild}
              onChange={(e) => setPlanForm((f) => ({ ...f, coversChild: e.target.value }))}
            />
          </FieldRow>
          <Field
            label={t("notes")}
            preset="longText"
            value={planForm.notes}
            onChange={(e) => setPlanForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <ModalFooter
          onCancel={() => {
            setPlanModal(null);
            setCopySourceId(null);
          }}
          onSubmit={() => void savePlan()}
          submitLabel={planModal === "copy" ? t("copyPlan") : tc("save")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>

      <ModalShell
        open={lineModal != null}
        onClose={() => setLineModal(null)}
        title={lineModal === "edit" ? t("editLine") : t("addLine")}
      >
        <div className="space-y-3">
          <CatalogField
            kind={"ENTITY_REF" as CatalogFieldKind}
            label={t("dish")}
            value={lineForm.menuItemId}
            options={menuOptions.map((m) => ({ value: m.id, label: m.label }))}
            onChange={(next) =>
              setLineForm((f) => ({
                ...f,
                menuItemId: Array.isArray(next) ? next[0] ?? "" : next,
              }))
            }
            disabled={lineModal === "edit"}
          />
          <CatalogField
            kind={"CLOSED_SMALL" as CatalogFieldKind}
            label={t("colStation")}
            value={lineForm.station}
            options={stationOptions}
            onChange={(next) =>
              setLineForm((f) => ({
                ...f,
                station: Array.isArray(next) ? next[0] ?? "MAIN" : next,
              }))
            }
            disabled={lineModal === "edit"}
          />
          <FieldRow cols={2}>
            <Field
              label={t("colPortions")}
              preset="shortText"
              inputMode="numeric"
              value={lineForm.plannedPortions}
              onChange={(e) => setLineForm((f) => ({ ...f, plannedPortions: e.target.value }))}
            />
            <Field
              label={t("colWaste")}
              preset="shortText"
              inputMode="decimal"
              value={lineForm.wastePct}
              onChange={(e) => setLineForm((f) => ({ ...f, wastePct: e.target.value }))}
            />
          </FieldRow>
        </div>
        <ModalFooter
          onCancel={() => setLineModal(null)}
          onSubmit={() => void saveLine()}
          submitLabel={tc("save")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>

      <ModalShell open={materialsOpen} onClose={() => setMaterialsOpen(false)} title={t("materials")}>
        {materials ? (
          <div className="space-y-3">
            <p className="text-sm text-[#7F8C8D]">
              {t("materialsHint", { missing: materials.missingBomCount })}
            </p>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
                <tr>
                  <th className="px-2 py-2">{t("colDish")}</th>
                  <th className="px-2 py-2">{t("colStation")}</th>
                  <th className="px-2 py-2">{t("colPortions")}</th>
                  <th className="px-2 py-2">{t("colRecipe")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {materials.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">
                      {stationOptions.find((s) => s.value === row.station)?.label ?? row.station}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{row.effectivePortions}</td>
                    <td className="px-2 py-2">{row.recipeSku || t("bomMissing")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <ModalFooter
          onCancel={() => setMaterialsOpen(false)}
          onSubmit={() => setMaterialsOpen(false)}
          cancelLabel={tc("cancel")}
          submitLabel={tc("close")}
        />
      </ModalShell>
    </div>
  );
}
