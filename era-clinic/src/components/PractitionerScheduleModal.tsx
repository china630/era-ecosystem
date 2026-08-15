"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldSelect,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type Pattern = "WEEKLY" | "WEEK_PARITY" | "MONTH_DAY_PARITY" | "CYCLE";
type Parity = "EVEN" | "ODD";
type ExceptionKind = "DAY_OFF" | "EXTRA_SHIFT" | "CUSTOM_HOURS";

type RuleForm = {
  pattern: Pattern;
  weekdays: number[];
  parity: Parity | null;
  cycleAnchor: string; // YYYY-MM-DD
  cycleLengthDays: number;
  cycleOffsets: string; // comma list
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  effectiveFrom: string;
  effectiveTo: string;
};

type ExceptionForm = {
  date: string;
  kind: ExceptionKind;
  startTime: string;
  endTime: string;
  note: string;
};

const WEEKDAYS: { n: number; key: string }[] = [
  { n: 1, key: "mon" },
  { n: 2, key: "tue" },
  { n: 3, key: "wed" },
  { n: 4, key: "thu" },
  { n: 5, key: "fri" },
  { n: 6, key: "sat" },
  { n: 0, key: "sun" },
];

function minToTime(min: number | null | undefined): string {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function isoToYmd(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function emptyRule(): RuleForm {
  return {
    pattern: "WEEKLY",
    weekdays: [1, 2, 3, 4, 5],
    parity: null,
    cycleAnchor: "",
    cycleLengthDays: 14,
    cycleOffsets: "",
    startTime: "09:00",
    endTime: "18:00",
    effectiveFrom: "",
    effectiveTo: "",
  };
}

function emptyException(): ExceptionForm {
  return { date: "", kind: "DAY_OFF", startTime: "09:00", endTime: "13:00", note: "" };
}

export function PractitionerScheduleModal({
  practitionerId,
  practitionerName,
  open,
  onClose,
}: {
  practitionerId: string | null;
  practitionerName: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("practitionerSchedule");
  const tc = useTranslations("common");

  const [rules, setRules] = useState<RuleForm[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!practitionerId) return;
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/admin/practitioners/${practitionerId}/schedule`);
    const data = await res.json();
    const row = (data.data ?? data) as {
      rules: Array<{
        pattern: Pattern;
        weekdays: number[];
        parity: Parity | null;
        cycleAnchor: string | null;
        cycleLengthDays: number | null;
        cycleOffsets: number[];
        startMinute: number;
        endMinute: number;
        effectiveFrom: string | null;
        effectiveTo: string | null;
      }>;
      exceptions: Array<{
        date: string;
        kind: ExceptionKind;
        startMinute: number | null;
        endMinute: number | null;
        note: string | null;
      }>;
    };
    setRules(
      (row.rules ?? []).map((r) => ({
        pattern: r.pattern,
        weekdays: r.weekdays ?? [],
        parity: r.parity,
        cycleAnchor: isoToYmd(r.cycleAnchor),
        cycleLengthDays: r.cycleLengthDays ?? 14,
        cycleOffsets: (r.cycleOffsets ?? []).join(", "),
        startTime: minToTime(r.startMinute),
        endTime: minToTime(r.endMinute),
        effectiveFrom: isoToYmd(r.effectiveFrom),
        effectiveTo: isoToYmd(r.effectiveTo),
      })),
    );
    setExceptions(
      (row.exceptions ?? []).map((e) => ({
        date: isoToYmd(e.date),
        kind: e.kind,
        startTime: minToTime(e.startMinute ?? 540),
        endTime: minToTime(e.endMinute ?? 780),
        note: e.note ?? "",
      })),
    );
    setLoading(false);
  }, [practitionerId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function patchRule(idx: number, patch: Partial<RuleForm>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function toggleWeekday(idx: number, n: number) {
    setRules((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              weekdays: r.weekdays.includes(n)
                ? r.weekdays.filter((x) => x !== n)
                : [...r.weekdays, n].sort(),
            }
          : r,
      ),
    );
  }

  async function save() {
    if (!practitionerId) return;
    setSaving(true);
    setMsg(null);
    const payload = {
      rules: rules.map((r, idx) => ({
        pattern: r.pattern,
        weekdays:
          r.pattern === "CYCLE" ? [] : r.weekdays,
        parity:
          r.pattern === "WEEK_PARITY" || r.pattern === "MONTH_DAY_PARITY" ? r.parity : null,
        cycleAnchor: r.pattern === "CYCLE" && r.cycleAnchor ? r.cycleAnchor : null,
        cycleLengthDays: r.pattern === "CYCLE" ? r.cycleLengthDays : null,
        cycleOffsets:
          r.pattern === "CYCLE"
            ? r.cycleOffsets
                .split(",")
                .map((x) => Number(x.trim()))
                .filter((x) => Number.isFinite(x))
            : [],
        startMinute: timeToMin(r.startTime),
        endMinute: timeToMin(r.endTime),
        effectiveFrom: r.effectiveFrom || null,
        effectiveTo: r.effectiveTo || null,
        sortOrder: idx,
      })),
      exceptions: exceptions
        .filter((e) => e.date)
        .map((e) => ({
          date: e.date,
          kind: e.kind,
          startMinute: e.kind === "DAY_OFF" ? null : timeToMin(e.startTime),
          endMinute: e.kind === "DAY_OFF" ? null : timeToMin(e.endTime),
          note: e.note || null,
        })),
    };
    const res = await fetch(`/api/admin/practitioners/${practitionerId}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setMsg(tc("saved"));
      onClose();
    } else {
      setMsg(tc("saveFailed"));
    }
  }

  return (
    <ModalShell
      open={open}
      title={`${t("title")} — ${practitionerName}`}
      onClose={onClose}
      maxWidthClass="max-w-3xl"
    >
      {loading ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
      ) : (
        <div className="space-y-5">
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("intro")}</p>

          {/* Shift rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium">{t("rules")}</p>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setRules((p) => [...p, emptyRule()])}
              >
                {t("addRule")}
              </button>
            </div>

            {rules.length === 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("noRules")}</p>
            ) : null}

            {rules.map((r, idx) => (
              <div key={idx} className={`${CARD_CONTAINER_CLASS} space-y-3 p-3`}>
                <div className="flex items-center justify-between gap-2">
                  <FieldSelect
                    label={t("pattern")}
                    preset="select"
                    value={r.pattern}
                    onChange={(e) => patchRule(idx, { pattern: e.target.value as Pattern })}
                    className="max-w-xs"
                  >
                    <option value="WEEKLY">{t("patternWeekly")}</option>
                    <option value="WEEK_PARITY">{t("patternWeekParity")}</option>
                    <option value="MONTH_DAY_PARITY">{t("patternMonthParity")}</option>
                    <option value="CYCLE">{t("patternCycle")}</option>
                  </FieldSelect>
                  <button
                    type="button"
                    className={`${TEXT_DANGER_CLASS} text-[12px]`}
                    onClick={() => setRules((p) => p.filter((_, i) => i !== idx))}
                  >
                    {tc("delete")}
                  </button>
                </div>

                {(r.pattern === "WEEKLY" ||
                  r.pattern === "WEEK_PARITY" ||
                  r.pattern === "MONTH_DAY_PARITY") && (
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((w) => (
                      <label
                        key={w.n}
                        className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[12px]"
                      >
                        <input
                          type="checkbox"
                          className={MODAL_CHECKBOX_CLASS}
                          checked={r.weekdays.includes(w.n)}
                          onChange={() => toggleWeekday(idx, w.n)}
                        />
                        {t(`wd_${w.key}`)}
                      </label>
                    ))}
                  </div>
                )}

                {(r.pattern === "WEEK_PARITY" || r.pattern === "MONTH_DAY_PARITY") && (
                  <FieldSelect
                    label={t("parity")}
                    preset="select"
                    value={r.parity ?? "EVEN"}
                    onChange={(e) => patchRule(idx, { parity: e.target.value as Parity })}
                    className="max-w-xs"
                  >
                    <option value="EVEN">
                      {r.pattern === "WEEK_PARITY" ? t("parityEvenWeek") : t("parityEvenDay")}
                    </option>
                    <option value="ODD">
                      {r.pattern === "WEEK_PARITY" ? t("parityOddWeek") : t("parityOddDay")}
                    </option>
                  </FieldSelect>
                )}

                {r.pattern === "CYCLE" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`mb-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {t("cycleAnchor")}
                      </label>
                      <input
                        type="date"
                        className={MODAL_INPUT_CLASS}
                        value={r.cycleAnchor}
                        onChange={(e) => patchRule(idx, { cycleAnchor: e.target.value })}
                      />
                    </div>
                    <Field
                      label={t("cycleLength")}
                      preset="count"
                      value={String(r.cycleLengthDays)}
                      onChange={(e) =>
                        patchRule(idx, { cycleLengthDays: Number(e.target.value) || 1 })
                      }
                    />
                    <div className="col-span-2">
                      <Field
                        label={t("cycleOffsets")}
                        preset="shortText"
                        hint={t("cycleOffsetsHint")}
                        value={r.cycleOffsets}
                        onChange={(e) => patchRule(idx, { cycleOffsets: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`mb-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {t("startTime")}
                    </label>
                    <input
                      type="time"
                      className={MODAL_INPUT_CLASS}
                      value={r.startTime}
                      onChange={(e) => patchRule(idx, { startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={`mb-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {t("endTime")}
                    </label>
                    <input
                      type="time"
                      className={MODAL_INPUT_CLASS}
                      value={r.endTime}
                      onChange={(e) => patchRule(idx, { endTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Exceptions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium">{t("exceptions")}</p>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setExceptions((p) => [...p, emptyException()])}
              >
                {t("addException")}
              </button>
            </div>

            {exceptions.map((e, idx) => (
              <div key={idx} className={`${CARD_CONTAINER_CLASS} grid grid-cols-2 gap-3 p-3`}>
                <div>
                  <label className={`mb-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>{t("date")}</label>
                  <input
                    type="date"
                    className={MODAL_INPUT_CLASS}
                    value={e.date}
                    onChange={(ev) =>
                      setExceptions((p) =>
                        p.map((x, i) => (i === idx ? { ...x, date: ev.target.value } : x)),
                      )
                    }
                  />
                </div>
                <FieldSelect
                  label={t("exceptionKind")}
                  preset="select"
                  value={e.kind}
                  onChange={(ev) =>
                    setExceptions((p) =>
                      p.map((x, i) =>
                        i === idx ? { ...x, kind: ev.target.value as ExceptionKind } : x,
                      ),
                    )
                  }
                >
                  <option value="DAY_OFF">{t("kindDayOff")}</option>
                  <option value="EXTRA_SHIFT">{t("kindExtra")}</option>
                  <option value="CUSTOM_HOURS">{t("kindCustom")}</option>
                </FieldSelect>
                {e.kind !== "DAY_OFF" && (
                  <>
                    <div>
                      <label className={`mb-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {t("startTime")}
                      </label>
                      <input
                        type="time"
                        className={MODAL_INPUT_CLASS}
                        value={e.startTime}
                        onChange={(ev) =>
                          setExceptions((p) =>
                            p.map((x, i) =>
                              i === idx ? { ...x, startTime: ev.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={`mb-1 block text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {t("endTime")}
                      </label>
                      <input
                        type="time"
                        className={MODAL_INPUT_CLASS}
                        value={e.endTime}
                        onChange={(ev) =>
                          setExceptions((p) =>
                            p.map((x, i) => (i === idx ? { ...x, endTime: ev.target.value } : x)),
                          )
                        }
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2 flex items-center justify-between">
                  <span className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{e.note}</span>
                  <button
                    type="button"
                    className={`${TEXT_DANGER_CLASS} text-[12px]`}
                    onClick={() => setExceptions((p) => p.filter((_, i) => i !== idx))}
                  >
                    {tc("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {msg ? <p className="text-[13px]">{msg}</p> : null}
        </div>
      )}
      <ModalFooter
        onCancel={onClose}
        onSubmit={() => void save()}
        submitLabel={tc("save")}
        busy={saving}
      />
    </ModalShell>
  );
}
