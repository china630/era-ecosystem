"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { loadHotelRevenueCodes } from "@/lib/hotel-revenue-client";
import {
  ALL_CLINIC_PRESETS,
  CLINIC_PRESET,
  type ClinicPresetCode,
} from "@/domain/presets/clinic-presets";
import {
  NAFTA_LANE_GATE,
  normalizeLaneGate,
  type LaneGatePolicy,
  type LaneId,
} from "@/domain/sanatorium/lane-gates";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  CatalogField,
  DatePicker,
  Field,
  FilterChips,
  FORM_STACK_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { PrintSettingsPanel } from "@/components/print/PrintSettingsPanel";

const PRESET_LABELS: Record<ClinicPresetCode, string> = {
  [CLINIC_PRESET.OUTPATIENT]: "Outpatient",
  [CLINIC_PRESET.INPATIENT_DAY]: "Inpatient day",
  [CLINIC_PRESET.SANATORIUM_CLINICAL]: "Sanatorium clinical",
  [CLINIC_PRESET.WELLNESS]: "Wellness",
};

type CardLimits = {
  patientCardResultsPreview: number;
  patientCardPlanPreview: number;
  patientCardHistoryPageSize: number;
  patientCardPlanPageSize: number;
};

type BathModeRow = { code: string; baths: number; rest: number };

type WorkHours = {
  dayStartHour: number;
  dayEndHour: number;
  lunchStartHour: number;
  lunchEndHour: number;
  closedWeekdays: number[];
  saturdayEndHour: number;
  shortenedDayEndHour: number;
  bathDayModes: BathModeRow[];
  defaultBathMode: string;
  closedDaySpendsOwedRest: boolean;
  closedDayResetsOpenStreak: boolean;
  weeklyNaftalanCap: number;
};

type SchedulingDefaults = {
  schedulingSlotMinutes: number;
  defaultProcedureGapMinutes: number;
  defaultAppointmentSlotMinutes: number;
  procedureCheckInMode: "QR" | "CODE" | "MANUAL";
  procedureCheckInWindow: "STRICT" | "SAME_DAY";
  procedureCheckInSameDayUntil: string;
  receptionProcedureCheckIn: boolean;
  peakModeEnabled: boolean;
  peakDayEndHour: number;
  programSchedulingMode: "AFTER_CHECKUP" | "ON_CHECKIN";
  doctorBonusPercentInHouse: number;
  doctorBonusPercentWalkIn: number;
  hotelFolioRevenueCode: string;
  noShowKeepsCharge: boolean;
  noShowBurnsQuota: boolean;
  extraProcedureRoute: "PLAN_BEFORE_PAY" | "HOLD_UNTIL_PAY";
};

const CARD_DEFAULTS: CardLimits = {
  patientCardResultsPreview: 5,
  patientCardPlanPreview: 15,
  patientCardHistoryPageSize: 25,
  patientCardPlanPageSize: 25,
};

function modesFrom(raw: unknown): BathModeRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return WORK_DEFAULTS.bathDayModes;
  return raw
    .map((row) => ({
      code: String((row as BathModeRow).code ?? "").toUpperCase(),
      baths: Number((row as BathModeRow).baths) || 1,
      rest: Number((row as BathModeRow).rest) || 0,
    }))
    .filter((row) => row.code);
}

const WORK_DEFAULTS: WorkHours = {
  dayStartHour: 9,
  dayEndHour: 18,
  lunchStartHour: 13,
  lunchEndHour: 14,
  closedWeekdays: [0],
  saturdayEndHour: 13,
  shortenedDayEndHour: 13,
  bathDayModes: [
    { code: "2", baths: 2, rest: 1 },
    { code: "3", baths: 3, rest: 1 },
    { code: "4", baths: 4, rest: 1 },
    { code: "5", baths: 5, rest: 1 },
    { code: "ALTERNATING", baths: 1, rest: 1 },
  ],
  defaultBathMode: "3",
  closedDaySpendsOwedRest: true,
  closedDayResetsOpenStreak: true,
  weeklyNaftalanCap: 5,
};

const SCHED_DEFAULTS: SchedulingDefaults = {
  schedulingSlotMinutes: 5,
  defaultProcedureGapMinutes: 5,
  defaultAppointmentSlotMinutes: 30,
  procedureCheckInMode: "QR",
  procedureCheckInWindow: "STRICT",
  procedureCheckInSameDayUntil: "",
  receptionProcedureCheckIn: true,
  peakModeEnabled: false,
  peakDayEndHour: 22,
  programSchedulingMode: "AFTER_CHECKUP",
  doctorBonusPercentInHouse: 0,
  doctorBonusPercentWalkIn: 0,
  hotelFolioRevenueCode: "",
  noShowKeepsCharge: true,
  noShowBurnsQuota: true,
  extraProcedureRoute: "PLAN_BEFORE_PAY",
};

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export default function ClinicAdminSettingsPage() {
  const t = useTranslations("adminSettings");
  const [revenueOptions, setRevenueOptions] = useState<{ value: string; label: string }[]>([]);
  const [revenueNotice, setRevenueNotice] = useState("");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [clinicName, setClinicName] = useState("");
  const [enabledPresets, setEnabledPresets] = useState<ClinicPresetCode[]>([
    CLINIC_PRESET.OUTPATIENT,
  ]);
  const [cardLimits, setCardLimits] = useState<CardLimits>(CARD_DEFAULTS);
  const [workHours, setWorkHours] = useState<WorkHours>(WORK_DEFAULTS);
  const [schedDefaults, setSchedDefaults] = useState<SchedulingDefaults>(SCHED_DEFAULTS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftPresets, setDraftPresets] = useState<ClinicPresetCode[]>([
    CLINIC_PRESET.OUTPATIENT,
  ]);
  const [draftCard, setDraftCard] = useState<CardLimits>(CARD_DEFAULTS);
  const [draftWork, setDraftWork] = useState<WorkHours>(WORK_DEFAULTS);
  const [draftSched, setDraftSched] = useState<SchedulingDefaults>(SCHED_DEFAULTS);
  const [laneGate, setLaneGate] = useState<LaneGatePolicy>(NAFTA_LANE_GATE);
  const [chip, setChip] = useState("clinic");

  useEffect(() => {
    void fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        const name = row.clinicName ?? "Demo clinic";
        setClinicName(name);
        setDraft(name);
        const presets = (row.enabledPresets ?? [CLINIC_PRESET.OUTPATIENT]) as ClinicPresetCode[];
        setEnabledPresets(presets);
        setDraftPresets(presets);
        const limits: CardLimits = {
          patientCardResultsPreview:
            row.patientCardResultsPreview ?? CARD_DEFAULTS.patientCardResultsPreview,
          patientCardPlanPreview:
            row.patientCardPlanPreview ?? CARD_DEFAULTS.patientCardPlanPreview,
          patientCardHistoryPageSize:
            row.patientCardHistoryPageSize ?? CARD_DEFAULTS.patientCardHistoryPageSize,
          patientCardPlanPageSize:
            row.patientCardPlanPageSize ?? CARD_DEFAULTS.patientCardPlanPageSize,
        };
        setCardLimits(limits);
        setDraftCard(limits);
        const hours: WorkHours = {
          dayStartHour: row.dayStartHour ?? WORK_DEFAULTS.dayStartHour,
          dayEndHour: row.dayEndHour ?? WORK_DEFAULTS.dayEndHour,
          lunchStartHour: row.lunchStartHour ?? WORK_DEFAULTS.lunchStartHour,
          lunchEndHour: row.lunchEndHour ?? WORK_DEFAULTS.lunchEndHour,
          closedWeekdays: row.closedWeekdays ?? WORK_DEFAULTS.closedWeekdays,
          saturdayEndHour: row.saturdayEndHour ?? WORK_DEFAULTS.saturdayEndHour,
          shortenedDayEndHour: row.shortenedDayEndHour ?? WORK_DEFAULTS.shortenedDayEndHour,
          bathDayModes: modesFrom(row.bathDayModes),
          defaultBathMode: String(row.defaultBathMode ?? WORK_DEFAULTS.defaultBathMode).toUpperCase(),
          closedDaySpendsOwedRest: row.closedDaySpendsOwedRest !== false,
          closedDayResetsOpenStreak: row.closedDayResetsOpenStreak !== false,
          weeklyNaftalanCap:
            typeof row.weeklyNaftalanCap === "number" ? row.weeklyNaftalanCap : WORK_DEFAULTS.weeklyNaftalanCap,
        };
        setWorkHours(hours);
        setDraftWork(hours);
        const sched: SchedulingDefaults = {
          schedulingSlotMinutes:
            row.schedulingSlotMinutes ?? SCHED_DEFAULTS.schedulingSlotMinutes,
          defaultProcedureGapMinutes:
            row.defaultProcedureGapMinutes ?? SCHED_DEFAULTS.defaultProcedureGapMinutes,
          defaultAppointmentSlotMinutes:
            row.defaultAppointmentSlotMinutes ??
            SCHED_DEFAULTS.defaultAppointmentSlotMinutes,
          procedureCheckInMode:
            row.procedureCheckInMode ??
            (row.checkInRequiresQr === false ? "MANUAL" : "QR"),
          procedureCheckInWindow:
            row.procedureCheckInWindow === "SAME_DAY" ? "SAME_DAY" : "STRICT",
          procedureCheckInSameDayUntil: row.procedureCheckInSameDayUntil
            ? String(row.procedureCheckInSameDayUntil).slice(0, 10)
            : "",
          receptionProcedureCheckIn: row.receptionProcedureCheckIn !== false,
          peakModeEnabled: Boolean(row.peakModeEnabled ?? SCHED_DEFAULTS.peakModeEnabled),
          peakDayEndHour: row.peakDayEndHour ?? SCHED_DEFAULTS.peakDayEndHour,
          programSchedulingMode:
            row.programSchedulingMode === "ON_CHECKIN" ? "ON_CHECKIN" : "AFTER_CHECKUP",
          doctorBonusPercentInHouse: Number(row.doctorBonusPercentInHouse ?? 0),
          doctorBonusPercentWalkIn: Number(row.doctorBonusPercentWalkIn ?? 0),
          hotelFolioRevenueCode:
            row.hotelFolioRevenueCode ?? SCHED_DEFAULTS.hotelFolioRevenueCode,
          noShowKeepsCharge: row.noShowKeepsCharge !== false,
          noShowBurnsQuota: row.noShowBurnsQuota !== false,
          extraProcedureRoute:
            row.extraProcedureRoute === "HOLD_UNTIL_PAY" ? "HOLD_UNTIL_PAY" : "PLAN_BEFORE_PAY",
        };
        setSchedDefaults(sched);
        setLaneGate(normalizeLaneGate(row.laneGate));
        setDraftSched(sched);
      });
  }, []);

  useEffect(() => {
    void loadHotelRevenueCodes().then((loaded) => {
      setRevenueOptions(loaded.options);
      setRevenueNotice(loaded.notice ? tc(loaded.notice) : "");
    });
  }, [tc]);

  function togglePreset(code: ClinicPresetCode) {
    setDraftPresets((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((p) => p !== code);
        return next.length > 0 ? next : [CLINIC_PRESET.OUTPATIENT];
      }
      return [...prev, code];
    });
  }

  async function save() {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicName: draft.trim() || clinicName,
        enabledPresets: draftPresets,
        ...draftCard,
        ...draftWork,
        ...draftSched,
        laneGate,
        procedureCheckInSameDayUntil: draftSched.procedureCheckInSameDayUntil
          ? `${draftSched.procedureCheckInSameDayUntil}T12:00:00.000Z`
          : null,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      const row = d.data ?? d;
      setClinicName(row.clinicName ?? draft);
      setEnabledPresets(row.enabledPresets ?? draftPresets);
      setCardLimits({
        patientCardResultsPreview:
          row.patientCardResultsPreview ?? draftCard.patientCardResultsPreview,
        patientCardPlanPreview: row.patientCardPlanPreview ?? draftCard.patientCardPlanPreview,
        patientCardHistoryPageSize:
          row.patientCardHistoryPageSize ?? draftCard.patientCardHistoryPageSize,
        patientCardPlanPageSize: row.patientCardPlanPageSize ?? draftCard.patientCardPlanPageSize,
      });
      setWorkHours({
        dayStartHour: row.dayStartHour ?? draftWork.dayStartHour,
        dayEndHour: row.dayEndHour ?? draftWork.dayEndHour,
        lunchStartHour: row.lunchStartHour ?? draftWork.lunchStartHour,
        lunchEndHour: row.lunchEndHour ?? draftWork.lunchEndHour,
        closedWeekdays: row.closedWeekdays ?? draftWork.closedWeekdays,
        saturdayEndHour: row.saturdayEndHour ?? draftWork.saturdayEndHour,
        shortenedDayEndHour: row.shortenedDayEndHour ?? draftWork.shortenedDayEndHour,
        bathDayModes: modesFrom(row.bathDayModes),
        defaultBathMode: String(row.defaultBathMode ?? draftWork.defaultBathMode).toUpperCase(),
        closedDaySpendsOwedRest: row.closedDaySpendsOwedRest !== false,
        closedDayResetsOpenStreak: row.closedDayResetsOpenStreak !== false,
        weeklyNaftalanCap:
          typeof row.weeklyNaftalanCap === "number" ? row.weeklyNaftalanCap : draftWork.weeklyNaftalanCap,
      });
      setSchedDefaults({
        schedulingSlotMinutes:
          row.schedulingSlotMinutes ?? draftSched.schedulingSlotMinutes,
        defaultProcedureGapMinutes:
          row.defaultProcedureGapMinutes ?? draftSched.defaultProcedureGapMinutes,
        defaultAppointmentSlotMinutes:
          row.defaultAppointmentSlotMinutes ?? draftSched.defaultAppointmentSlotMinutes,
        procedureCheckInMode:
          row.procedureCheckInMode ?? draftSched.procedureCheckInMode,
        procedureCheckInWindow:
          row.procedureCheckInWindow === "SAME_DAY" ? "SAME_DAY" : "STRICT",
        procedureCheckInSameDayUntil: row.procedureCheckInSameDayUntil
          ? String(row.procedureCheckInSameDayUntil).slice(0, 10)
          : "",
        receptionProcedureCheckIn: row.receptionProcedureCheckIn !== false,
        peakModeEnabled: Boolean(row.peakModeEnabled ?? draftSched.peakModeEnabled),
        peakDayEndHour: row.peakDayEndHour ?? draftSched.peakDayEndHour,
        programSchedulingMode:
          row.programSchedulingMode === "ON_CHECKIN" ? "ON_CHECKIN" : "AFTER_CHECKUP",
        doctorBonusPercentInHouse: Number(
          row.doctorBonusPercentInHouse ?? draftSched.doctorBonusPercentInHouse,
        ),
        doctorBonusPercentWalkIn: Number(
          row.doctorBonusPercentWalkIn ?? draftSched.doctorBonusPercentWalkIn,
        ),
        hotelFolioRevenueCode:
          row.hotelFolioRevenueCode ?? draftSched.hotelFolioRevenueCode,
        noShowKeepsCharge: row.noShowKeepsCharge !== false,
        noShowBurnsQuota: row.noShowBurnsQuota !== false,
        extraProcedureRoute:
          row.extraProcedureRoute === "HOLD_UNTIL_PAY" ? "HOLD_UNTIL_PAY" : "PLAN_BEFORE_PAY",
      });
      setLaneGate(normalizeLaneGate(row.laneGate));
      setOpen(false);
      showSuccess(tc("saved"));
      window.location.reload();
    } else {
      showApiError({ error: tc("saveFailed") });
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={SECONDARY_BUTTON_CLASS}>
            ← {tNav("home")}
          </Link>
        }
      />
      <FilterChips
        ariaLabel={t("settingsChips")}
        value={chip}
        onChange={setChip}
        alwaysVisibleIds={["clinic", "day", "baths", "procedures", "labs", "money", "card", "print"]}
        items={[
          { id: "clinic", label: t("chipClinic") },
          { id: "day", label: t("chipDay") },
          { id: "baths", label: t("chipBaths") },
          { id: "procedures", label: t("chipProcedures") },
          { id: "labs", label: t("chipLabs") },
          { id: "money", label: t("chipMoney") },
          { id: "card", label: t("chipCard") },
          { id: "print", label: t("chipPrint") },
        ]}
      />
      {chip === "labs" ? <PrintSettingsPanel part="signers" /> : null}
      {chip === "print" ? <PrintSettingsPanel part="brand" /> : null}
      {chip === "labs" || chip === "print" ? null : (
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("field")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("value")}</th>
            <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("edit")}
                onClick={() => {
                  setDraft(clinicName);
                  setDraftPresets(enabledPresets);
                  setDraftCard(cardLimits);
                  setDraftWork(workHours);
                  setDraftSched(schedDefaults);
                  setOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <style>{`tr[data-chip]:not([data-chip="${chip}"]){display:none}`}</style>
          <tr data-chip="clinic" className="border-b">
            <td className="p-3 font-medium">{t("clinicName")}</td>
            <td className="p-3">{clinicName}</td>
          </tr>
          <tr data-chip="clinic" className="border-b">
            <td className="p-3 font-medium">{t("enabledPresets")}</td>
            <td className="p-3">
              {enabledPresets.map((p) => PRESET_LABELS[p] ?? p).join(", ")}
            </td>
          </tr>
          <tr data-chip="day" className="border-b">
            <td className="p-3 font-medium">{t("workingHoursTitle")}</td>
            <td className="p-3">
              <Link href="/admin/working-hours" className={LINK_ACCENT_CLASS}>
                {t("openWorkingHours")}
              </Link>
            </td>
          </tr>
          <tr data-chip="baths" className="border-b">
            <td className="p-3 font-medium">{t("bathModesTitle")}</td>
            <td className="p-3">
              {workHours.bathDayModes
                .map((row) => `${row.code}: ${row.baths}+${row.rest}`)
                .join(", ")}
            </td>
          </tr>
          <tr data-chip="baths" className="border-b">
            <td className="p-3 font-medium">{t("defaultBathMode")}</td>
            <td className="p-3">{workHours.defaultBathMode}</td>
          </tr>
          <tr data-chip="baths" className="border-b">
            <td className="p-3 font-medium">{t("closedDaySpendsOwedRest")}</td>
            <td className="p-3">{workHours.closedDaySpendsOwedRest ? t("bathFlagOn") : t("bathFlagOff")}</td>
          </tr>
          <tr data-chip="baths" className="border-b">
            <td className="p-3 font-medium">{t("closedDayResetsOpenStreak")}</td>
            <td className="p-3">{workHours.closedDayResetsOpenStreak ? t("bathFlagOn") : t("bathFlagOff")}</td>
          </tr>
          <tr data-chip="baths" className="border-b">
            <td className="p-3 font-medium">{t("weeklyNaftalanCap")}</td>
            <td className="p-3">{workHours.weeklyNaftalanCap}</td>
          </tr>
          <tr data-chip="money" className="border-b">
            <td className="p-3 font-medium">{t("hotelFolioRevenueCode")}</td>
            <td className="p-3">{schedDefaults.hotelFolioRevenueCode || "—"}</td>
          </tr>
          <tr data-chip="procedures" className="border-t border-slate-100">
            <td className="p-3 font-medium">{t("schedulingSlotMinutes")}</td>
            <td className="p-3">{schedDefaults.schedulingSlotMinutes} min</td>
          </tr>
          <tr data-chip="procedures" className="border-b">
            <td className="p-3 font-medium">{t("defaultProcedureGapMinutes")}</td>
            <td className="p-3">{schedDefaults.defaultProcedureGapMinutes} min</td>
          </tr>
          <tr data-chip="procedures" className="border-b">
            <td className="p-3 font-medium">{t("defaultAppointmentSlotMinutes")}</td>
            <td className="p-3">{schedDefaults.defaultAppointmentSlotMinutes} min</td>
          </tr>
          <tr data-chip="procedures" className="border-b">
            <td className="p-3 font-medium">{t("procedureCheckInMode")}</td>
            <td className="p-3">{schedDefaults.procedureCheckInMode}</td>
          </tr>
          <tr data-chip="procedures" className="border-b">
            <td className="p-3 font-medium">
              {t("programSchedulingMode", { defaultValue: "Program scheduling mode" })}
            </td>
            <td className="p-3">{schedDefaults.programSchedulingMode}</td>
          </tr>
          <tr data-chip="money" className="border-b">
            <td className="p-3 font-medium">{t("doctorBonusPercentInHouse")}</td>
            <td className="p-3">{schedDefaults.doctorBonusPercentInHouse}%</td>
          </tr>
          <tr data-chip="money" className="border-b">
            <td className="p-3 font-medium">{t("doctorBonusPercentWalkIn")}</td>
            <td className="p-3">{schedDefaults.doctorBonusPercentWalkIn}%</td>
          </tr>
          <tr data-chip="card" className="border-b">
            <td className="p-3 font-medium">{t("cardResultsPreview")}</td>
            <td className="p-3">{cardLimits.patientCardResultsPreview}</td>
          </tr>
          <tr data-chip="card" className="border-b">
            <td className="p-3 font-medium">{t("cardPlanPreview")}</td>
            <td className="p-3">{cardLimits.patientCardPlanPreview}</td>
          </tr>
          <tr data-chip="card">
            <td className="p-3 font-medium">{t("cardHistoryPageSize")}</td>
            <td className="p-3">{cardLimits.patientCardHistoryPageSize}</td>
          </tr>
        </tbody>
      </table>
      )}
      <ModalShell open={open} title={t("editClinic")} onClose={() => setOpen(false)}>
        <div className={FORM_STACK_CLASS}>
          <div className={chip === "clinic" ? "contents" : "hidden"}>
          <Field
            label={t("clinicName")}
            preset="shortText"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <fieldset className="space-y-2 text-[13px]">
            <legend className={MODAL_FIELD_LABEL_CLASS}>{t("enabledPresets")}</legend>
            {ALL_CLINIC_PRESETS.map((code) => (
              <label key={code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={draftPresets.includes(code)}
                  onChange={() => togglePreset(code)}
                />
                {PRESET_LABELS[code] ?? code}
              </label>
            ))}
          </fieldset>
          </div>
          <div className={chip === "day" ? "space-y-2" : "hidden"}>
            <p className="text-[13px] text-[#7F8C8D]">{t("workingHoursMovedHint")}</p>
            <Link href="/admin/working-hours" className={SECONDARY_BUTTON_CLASS}>
              {t("openWorkingHours")}
            </Link>
          </div>
          <fieldset className={`grid gap-3 text-[13px] sm:grid-cols-2 ${chip === "baths" ? "" : "hidden"}`}>
            <legend className={`${MODAL_FIELD_LABEL_CLASS} sm:col-span-2`}>{t("bathModesTitle")}</legend>
            <div className={`space-y-2 sm:col-span-2 ${chip === "baths" ? "" : "hidden"}`}>
              <p className={MODAL_FIELD_LABEL_CLASS}>{t("bathModesTitle")}</p>
              {draftWork.bathDayModes.map((row, index) => (
                <div key={`${row.code}-${index}`} className="grid grid-cols-4 items-end gap-2">
                  <Field
                    label={t("bathModeCode")}
                    preset="shortText"
                    value={row.code}
                    onChange={(e) =>
                      setDraftWork((prev) => ({
                        ...prev,
                        bathDayModes: prev.bathDayModes.map((item, i) =>
                          i === index ? { ...item, code: e.target.value.toUpperCase() } : item,
                        ),
                      }))
                    }
                  />
                  <Field
                    label={t("bathModeBaths")}
                    preset="count"
                    type="number"
                    min={1}
                    max={14}
                    value={row.baths}
                    onChange={(e) =>
                      setDraftWork((prev) => ({
                        ...prev,
                        bathDayModes: prev.bathDayModes.map((item, i) =>
                          i === index ? { ...item, baths: Number(e.target.value) || 1 } : item,
                        ),
                      }))
                    }
                  />
                  <Field
                    label={t("bathModeRest")}
                    preset="count"
                    type="number"
                    min={0}
                    max={7}
                    value={row.rest}
                    onChange={(e) =>
                      setDraftWork((prev) => ({
                        ...prev,
                        bathDayModes: prev.bathDayModes.map((item, i) =>
                          i === index ? { ...item, rest: Number(e.target.value) || 0 } : item,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() =>
                      setDraftWork((prev) => ({
                        ...prev,
                        bathDayModes: prev.bathDayModes.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    {tc("delete")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() =>
                  setDraftWork((prev) => ({
                    ...prev,
                    bathDayModes: [...prev.bathDayModes, { code: "", baths: 1, rest: 1 }],
                  }))
                }
              >
                {t("addBathMode")}
              </button>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("defaultBathMode")}
                value={draftWork.defaultBathMode}
                onChange={(next) =>
                  setDraftWork((prev) => ({
                    ...prev,
                    defaultBathMode: String(Array.isArray(next) ? next[0] ?? "" : next).toUpperCase(),
                  }))
                }
                options={draftWork.bathDayModes.map((row) => ({
                  value: row.code,
                  label: `${row.code} (${row.baths}+${row.rest})`,
                }))}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={draftWork.closedDaySpendsOwedRest}
                  onChange={(e) =>
                    setDraftWork((prev) => ({
                      ...prev,
                      closedDaySpendsOwedRest: e.target.checked,
                    }))
                  }
                />
                {t("closedDaySpendsOwedRest")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={draftWork.closedDayResetsOpenStreak}
                  onChange={(e) =>
                    setDraftWork((prev) => ({
                      ...prev,
                      closedDayResetsOpenStreak: e.target.checked,
                    }))
                  }
                />
                {t("closedDayResetsOpenStreak")}
              </label>
              <Field
                label={t("weeklyNaftalanCap")}
                preset="count"
                type="number"
                min={0}
                max={14}
                value={draftWork.weeklyNaftalanCap}
                onChange={(e) =>
                  setDraftWork((prev) => ({
                    ...prev,
                    weeklyNaftalanCap: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </fieldset>
          <div className={chip === "money" ? "contents" : "hidden"}>
          {revenueNotice ? <p className="text-sm text-[#B7950B]">{revenueNotice}</p> : null}
          <CatalogField
            kind="SEARCHABLE"
            label={t("hotelFolioRevenueCode")}
            options={revenueOptions}
            value={draftSched.hotelFolioRevenueCode}
            onChange={(v) =>
              setDraftSched((prev) => ({
                ...prev,
                hotelFolioRevenueCode: String(v ?? "").trim(),
              }))
            }
          />
          </div>
          <div className={chip === "procedures" ? "contents" : "hidden"}>
          <Field
            label={t("schedulingSlotMinutes")}
            preset="count"
            type="number"
            min={1}
            max={60}
            value={draftSched.schedulingSlotMinutes}
            onChange={(e) =>
              setDraftSched((prev) => ({
                ...prev,
                schedulingSlotMinutes: Number(e.target.value) || prev.schedulingSlotMinutes,
              }))
            }
          />
          <Field
            label={t("defaultProcedureGapMinutes")}
            preset="count"
            type="number"
            min={0}
            max={240}
            value={draftSched.defaultProcedureGapMinutes}
            onChange={(e) =>
              setDraftSched((prev) => ({
                ...prev,
                defaultProcedureGapMinutes: Number(e.target.value) || prev.defaultProcedureGapMinutes,
              }))
            }
          />
          <Field
            label={t("defaultAppointmentSlotMinutes")}
            preset="count"
            type="number"
            min={5}
            max={120}
            value={draftSched.defaultAppointmentSlotMinutes}
            onChange={(e) =>
              setDraftSched((prev) => ({
                ...prev,
                defaultAppointmentSlotMinutes:
                  Number(e.target.value) || prev.defaultAppointmentSlotMinutes,
              }))
            }
          />
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-sm opacity-80">{t("procedureCheckInMode")}</span>
            <select
              value={draftSched.procedureCheckInMode}
              onChange={(e) =>
                setDraftSched((prev) => ({
                  ...prev,
                  procedureCheckInMode: e.target.value as
                    | "QR"
                    | "CODE"
                    | "MANUAL",
                }))
              }
              className="w-56 rounded border px-2 py-1"
            >
              <option value="QR">QR</option>
              <option value="CODE">CODE</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("procedureCheckInWindow")}
            hint={t("procedureCheckInWindowHint")}
            value={draftSched.procedureCheckInWindow}
            emptyLabel={null}
            options={[
              { value: "STRICT", label: t("procedureCheckInWindowStrict") },
              { value: "SAME_DAY", label: t("procedureCheckInWindowSameDay") },
            ]}
            onChange={(next) => {
              const value = Array.isArray(next) ? next[0] : next;
              setDraftSched((prev) => ({
                ...prev,
                procedureCheckInWindow: value === "SAME_DAY" ? "SAME_DAY" : "STRICT",
              }));
            }}
          />
          {draftSched.procedureCheckInWindow === "SAME_DAY" ? (
            <DatePicker
              label={t("procedureCheckInSameDayUntil")}
              hint={t("procedureCheckInSameDayUntilHint")}
              value={draftSched.procedureCheckInSameDayUntil}
              onChange={(iso) =>
                setDraftSched((prev) => ({
                  ...prev,
                  procedureCheckInSameDayUntil: iso,
                }))
              }
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draftSched.receptionProcedureCheckIn}
              onChange={(e) =>
                setDraftSched((prev) => ({
                  ...prev,
                  receptionProcedureCheckIn: e.target.checked,
                }))
              }
            />
            <span>
              {t("receptionProcedureCheckIn")}
              <span className={`ml-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>
                {t("receptionProcedureCheckInHint")}
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draftSched.noShowKeepsCharge}
              onChange={(e) =>
                setDraftSched((prev) => ({ ...prev, noShowKeepsCharge: e.target.checked }))
              }
            />
            {t("noShowKeepsCharge")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draftSched.noShowBurnsQuota}
              onChange={(e) =>
                setDraftSched((prev) => ({ ...prev, noShowBurnsQuota: e.target.checked }))
              }
            />
            {t("noShowBurnsQuota")}
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("extraProcedureRoute")}
            hint={t("extraProcedureRouteHint")}
            value={draftSched.extraProcedureRoute}
            emptyLabel={null}
            options={[
              { value: "PLAN_BEFORE_PAY", label: t("extraProcedureRouteShow") },
              { value: "HOLD_UNTIL_PAY", label: t("extraProcedureRouteHold") },
            ]}
            onChange={(next) => {
              const value = Array.isArray(next) ? next[0] : next;
              setDraftSched((prev) => ({
                ...prev,
                extraProcedureRoute: value === "HOLD_UNTIL_PAY" ? "HOLD_UNTIL_PAY" : "PLAN_BEFORE_PAY",
              }));
            }}
          />
          <div className="text-sm">
            <p className="mb-2 font-medium">{t("laneGate")}</p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th />
                  {(["anamnesis", "complaints", "diagnoses"] as const).map((fact) => (
                    <th key={fact} className="px-2 text-left font-medium">{t(`laneFact_${fact}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["procedures", "labs", "visits"] as LaneId[]).map((lane) => (
                  <tr key={lane}>
                    <td className="py-1 pr-2">{t(`lane_${lane}`)}</td>
                    {(["anamnesis", "complaints", "diagnoses"] as const).map((fact) => (
                      <td key={fact} className="px-2">
                        <input
                          type="checkbox"
                          checked={laneGate[lane][fact]}
                          onChange={(e) =>
                            setLaneGate((prev) => ({
                              ...prev,
                              [lane]: { ...prev[lane], [fact]: e.target.checked },
                            }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("programSchedulingMode")}
            value={draftSched.programSchedulingMode}
            emptyLabel={null}
            options={[
              {
                value: "AFTER_CHECKUP",
                label: t("programSchedulingModeAfterCheckup"),
              },
              {
                value: "ON_CHECKIN",
                label: t("programSchedulingModeOnCheckin"),
              },
            ]}
            onChange={(next) => {
              const v = Array.isArray(next) ? next[0] : next;
              setDraftSched((prev) => ({
                ...prev,
                programSchedulingMode:
                  v === "ON_CHECKIN" ? "ON_CHECKIN" : "AFTER_CHECKUP",
              }));
            }}
          />
          </div>
          <div className={chip === "money" ? "contents" : "hidden"}>
          <Field
            label={t("doctorBonusPercentInHouse")}
            preset="count"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={draftSched.doctorBonusPercentInHouse}
            onChange={(e) =>
              setDraftSched((prev) => ({
                ...prev,
                doctorBonusPercentInHouse: Number(e.target.value) || 0,
              }))
            }
          />
          <Field
            label={t("doctorBonusPercentWalkIn")}
            preset="count"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={draftSched.doctorBonusPercentWalkIn}
            onChange={(e) =>
              setDraftSched((prev) => ({
                ...prev,
                doctorBonusPercentWalkIn: Number(e.target.value) || 0,
              }))
            }
          />
          </div>
          <fieldset className={`grid gap-3 text-[13px] sm:grid-cols-2 ${chip === "card" ? "" : "hidden"}`}>
            <legend className={`${MODAL_FIELD_LABEL_CLASS} sm:col-span-2`}>{t("cardLimitsTitle")}</legend>
            {(
              [
                ["patientCardResultsPreview", "cardResultsPreview"],
                ["patientCardPlanPreview", "cardPlanPreview"],
                ["patientCardHistoryPageSize", "cardHistoryPageSize"],
              ] as const
            ).map(([key, labelKey]) => (
              <Field
                key={key}
                label={t(labelKey)}
                preset="count"
                type="number"
                min={key.includes("Page") ? 10 : 1}
                max={key.includes("Page") ? 100 : 50}
                value={draftCard[key]}
                onChange={(e) =>
                  setDraftCard((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value) || prev[key],
                  }))
                }
              />
            ))}
          </fieldset>
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
      <PrintSettingsPanel />
    </>
  );
}
