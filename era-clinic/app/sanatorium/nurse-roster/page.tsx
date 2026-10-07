"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  FORM_STACK_CLASS,
  LINK_ACCENT_CLASS,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Warning = { kind: string; from: string; to: string; note: string | null };

type Line = {
  id: string;
  procedureTypeId: string;
  procedureCode: string;
  procedureName: string;
  practitionerId: string | null;
  practitionerName: string | null;
  stable: boolean;
  note: string | null;
  warnings: Warning[];
};

type StaffRow = {
  id: string;
  code: string;
  fullName: string;
  specialty: string | null;
  staffKind?: string;
  skillProcedureTypeIds: string[];
  warnings: Warning[];
};

function ReplaceArrows() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M19 8a7 7 0 0 0-12-3L5 7"
        fill="none"
        stroke="#c0392b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 3v4h4"
        fill="none"
        stroke="#c0392b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 16a7 7 0 0 0 12 3l2-2"
        fill="none"
        stroke="#1e8449"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 21v-4h-4"
        fill="none"
        stroke="#1e8449"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Absence = {
  id: string;
  practitionerId: string;
  kind: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
};

type DayOverride = {
  id: string;
  dutyDate: string;
  procedureTypeId: string;
  procedureCode: string;
  procedureName: string;
  practitionerId: string;
  practitionerName: string;
  practitionerCode: string;
  note: string | null;
};

type RosterView = {
  roster: {
    id: string;
    yearMonth: string;
    staffKind: "NURSE" | "LAB";
    status: "DRAFT" | "APPROVED";
    copiedFromYearMonth: string | null;
  };
  lines: Line[];
  staff: StaffRow[];
  absences: Absence[];
  dayOverrides: DayOverride[];
};

type MatrixView = "procedures" | "nurses";

function currentYearMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function shiftYearMonth(yearMonth: string, delta: number) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function NurseRosterPage() {
  const t = useTranslations("nurseRoster");
  const tm = useTranslations("masterData");
  const tc = useTranslations("common");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [staffKind, setStaffKind] = useState<"NURSE" | "LAB">("NURSE");
  const [matrixView, setMatrixView] = useState<MatrixView>("procedures");
  const [view, setView] = useState<RosterView | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [dayOverrides, setDayOverrides] = useState<DayOverride[]>([]);
  const [busy, setBusy] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    practitionerId: "",
    kind: "VACATION",
    startsOn: "",
    endsOn: "",
    note: "",
  });
  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    procedureTypeId: "",
    dutyDate: "",
    practitionerId: "",
    note: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [nursePage, setNursePage] = useState(1);
  const [procedureQuery, setProcedureQuery] = useState("");

  function procedureMatches(line: { procedureName: string; procedureCode: string }) {
    const query = procedureQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      line.procedureName.toLowerCase().includes(query) ||
      line.procedureCode.toLowerCase().includes(query)
    );
  }

  const procedureRows = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<string, Line[]>();
    for (const line of lines) {
      if (!groups.has(line.procedureTypeId)) order.push(line.procedureTypeId);
      const list = groups.get(line.procedureTypeId) ?? [];
      list.push(line);
      groups.set(line.procedureTypeId, list);
    }
    const query = procedureQuery.trim().toLowerCase();
    return order
      .map((id) => {
        const group = groups.get(id) ?? [];
        const head = group[0];
        return {
          procedureTypeId: id,
          procedureCode: head.procedureCode,
          procedureName: head.procedureName,
          stable: group.some((line) => line.stable),
          assignees: group.filter((line) => line.practitionerId),
        };
      })
      .filter((row) => {
        if (!query) return true;
        return (
          row.procedureName.toLowerCase().includes(query) ||
          row.procedureCode.toLowerCase().includes(query)
        );
      });
  }, [lines, procedureQuery]);

  const pagedLines = useMemo(() => {
    const start = (page - 1) * pageSize;
    return procedureRows.slice(start, start + pageSize);
  }, [procedureRows, page, pageSize]);

  const staffRows = view?.staff ?? [];
  const pagedStaff = useMemo(() => {
    const start = (nursePage - 1) * pageSize;
    return staffRows.slice(start, start + pageSize);
  }, [staffRows, nursePage, pageSize]);

  useEffect(() => {
    setPage(1);
    setNursePage(1);
  }, [yearMonth, staffKind, pageSize, matrixView, procedureQuery]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/sanatorium/nurse-roster?yearMonth=${yearMonth}&staffKind=${staffKind}`,
      );
      const data = (await res.json()) as RosterView & { error?: string };
      if (!res.ok) {
        showApiError(data, t("loadFailed"));
        return;
      }
      setView(data);
      setLines(data.lines);
      setDayOverrides(data.dayOverrides ?? []);
      setPage(1);
      setNursePage(1);
    } finally {
      setBusy(false);
    }
  }, [yearMonth, staffKind, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function kindLabel(kind: string | undefined) {
    if (kind === "NURSE") return tm("staffKindNurse");
    if (kind === "LAB") return tm("staffKindLab");
    if (kind === "BATH") return tm("staffKindBath");
    if (kind === "MASSAGE") return tm("staffKindMassage");
    if (kind === "DOCTOR") return tm("staffKindDoctor");
    return "";
  }

  const staffOptions = useMemo(
    () =>
      (view?.staff ?? []).map((s) => {
        const kind = kindLabel(s.staffKind);
        const base = s.specialty ? `${s.fullName} (${s.specialty})` : s.fullName;
        return { value: s.id, label: kind ? `${base} · ${kind}` : base };
      }),
    [view?.staff, tm],
  );

  const procedureOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const line of lines) {
      if (seen.has(line.procedureTypeId)) continue;
      seen.add(line.procedureTypeId);
      options.push({
        value: line.procedureTypeId,
        label: `${line.procedureName} (${line.procedureCode})`,
      });
    }
    return options;
  }, [lines]);

  const kindOptions = useMemo(
    () => [
      { value: "NURSE", label: t("kindNurse") },
      { value: "LAB", label: t("kindLab") },
    ],
    [t],
  );

  const viewOptions = useMemo(
    () => [
      { value: "procedures", label: t("viewProcedures") },
      { value: "nurses", label: t("viewNurses") },
    ],
    [t],
  );

  const absenceKindOptions = useMemo(
    () => [
      { value: "VACATION", label: t("absenceVacation") },
      { value: "SICK", label: t("absenceSick") },
      { value: "TRAINING", label: t("absenceTraining") },
      { value: "OTHER", label: t("absenceOther") },
    ],
    [t],
  );

  function personName(practitionerId: string) {
    return view?.staff.find((s) => s.id === practitionerId)?.fullName ?? null;
  }

  function addAssignee(procedureTypeId: string, practitionerId: string) {
    if (!practitionerId) return;
    setLines((prev) => {
      if (
        prev.some(
          (line) =>
            line.procedureTypeId === procedureTypeId && line.practitionerId === practitionerId,
        )
      ) {
        return prev;
      }
      const sample = prev.find((line) => line.procedureTypeId === procedureTypeId);
      if (!sample) return prev;
      const withoutEmpty = prev.filter(
        (line) => !(line.procedureTypeId === procedureTypeId && !line.practitionerId),
      );
      return [
        ...withoutEmpty,
        {
          ...sample,
          id: `new-${procedureTypeId}-${practitionerId}`,
          practitionerId,
          practitionerName: personName(practitionerId),
          warnings: [],
        },
      ];
    });
  }

  function removeAssignee(procedureTypeId: string, practitionerId: string) {
    setLines((prev) => {
      const sample = prev.find((line) => line.procedureTypeId === procedureTypeId);
      const next = prev.filter(
        (line) =>
          !(line.procedureTypeId === procedureTypeId && line.practitionerId === practitionerId),
      );
      if (!sample || next.some((line) => line.procedureTypeId === procedureTypeId)) return next;
      return [
        ...next,
        {
          ...sample,
          id: `empty-${procedureTypeId}`,
          practitionerId: null,
          practitionerName: null,
          warnings: [],
        },
      ];
    });
  }

  function setNurseProcedures(practitionerId: string, procedureTypeIds: string[]) {
    const want = new Set(procedureTypeIds);
    setLines((prev) => {
      let next = prev.filter(
        (line) => !(line.practitionerId === practitionerId && !want.has(line.procedureTypeId)),
      );
      for (const procedureTypeId of want) {
        if (
          next.some(
            (line) =>
              line.procedureTypeId === procedureTypeId && line.practitionerId === practitionerId,
          )
        ) {
          continue;
        }
        const sample =
          next.find((line) => line.procedureTypeId === procedureTypeId) ??
          prev.find((line) => line.procedureTypeId === procedureTypeId);
        if (!sample) continue;
        next = next.filter(
          (line) => !(line.procedureTypeId === procedureTypeId && !line.practitionerId),
        );
        next.push({
          ...sample,
          id: `new-${procedureTypeId}-${practitionerId}`,
          practitionerId,
          practitionerName: personName(practitionerId),
          warnings: [],
        });
      }
      const seen = new Set<string>();
      for (const line of next) seen.add(line.procedureTypeId);
      for (const line of prev) {
        if (seen.has(line.procedureTypeId)) continue;
        seen.add(line.procedureTypeId);
        next.push({
          ...line,
          id: `empty-${line.procedureTypeId}`,
          practitionerId: null,
          practitionerName: null,
          warnings: [],
        });
      }
      return next;
    });
  }

  function toggleStable(procedureTypeId: string) {
    setLines((prev) => {
      const next = !prev.find((line) => line.procedureTypeId === procedureTypeId)?.stable;
      return prev.map((line) =>
        line.procedureTypeId === procedureTypeId ? { ...line, stable: next } : line,
      );
    });
  }

  function openSubstitute(procedureTypeId: string, dutyDate?: string) {
    setSubForm({
      procedureTypeId,
      dutyDate: dutyDate ?? `${yearMonth}-01`,
      practitionerId: view?.staff[0]?.id ?? "",
      note: "",
    });
    setSubOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/nurse-roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          staffKind,
          lines: lines.map((l) => ({
            procedureTypeId: l.procedureTypeId,
            practitionerId: l.practitionerId,
            stable: l.stable,
            note: l.note,
          })),
        }),
      });
      const data = (await res.json()) as RosterView & { error?: string };
      if (!res.ok) {
        showApiError(data, t("saveFailed"));
        return;
      }
      setView(data);
      setLines(data.lines);
      setDayOverrides(data.dayOverrides ?? []);
      showSuccess(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function postAction(action: "approve" | "copyPrevious") {
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/nurse-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, yearMonth, staffKind }),
      });
      const data = (await res.json()) as RosterView & { error?: string };
      if (!res.ok) {
        showApiError(data, t("saveFailed"));
        return;
      }
      setView(data);
      setLines(data.lines);
      setDayOverrides(data.dayOverrides ?? []);
      setPage(1);
      showSuccess(action === "approve" ? t("approved") : t("copied"));
    } finally {
      setBusy(false);
    }
  }

  async function addAbsence() {
    if (!absenceForm.practitionerId || !absenceForm.startsOn || !absenceForm.endsOn) {
      showApiError({ error: t("absenceRequired") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/staff-absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(absenceForm),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        showApiError(data, t("saveFailed"));
        return;
      }
      setAbsenceOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeAbsence(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sanatorium/staff-absences?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveSubstitute() {
    if (!subForm.procedureTypeId || !subForm.dutyDate || !subForm.practitionerId) {
      showApiError({ error: t("substituteRequired") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/nurse-roster/day-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth,
          staffKind,
          dutyDate: subForm.dutyDate,
          procedureTypeId: subForm.procedureTypeId,
          practitionerId: subForm.practitionerId,
          note: subForm.note || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        showApiError(data, t("saveFailed"));
        return;
      }
      setSubOpen(false);
      showSuccess(t("substituteSaved"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sanatorium/nurse-roster/day-overrides?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  }

  const approved = view?.roster.status === "APPROVED";

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setMatrixView("procedures");
          setProcedureQuery("");
        }}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("staffKind")}
          value={staffKind}
          onChange={(v) => setStaffKind(String(v) === "LAB" ? "LAB" : "NURSE")}
          options={kindOptions}
          emptyLabel={null}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("viewMode")}
          value={matrixView}
          onChange={(v) =>
            setMatrixView(String(v) === "nurses" ? "nurses" : "procedures")
          }
          options={viewOptions}
          emptyLabel={null}
        />
        <Field
          label={t("procedureFilter")}
          preset="shortText"
          value={procedureQuery}
          onChange={(e) => setProcedureQuery(e.target.value)}
        />
        <div className="flex items-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setYearMonth((m) => shiftYearMonth(m, -1))}
          >
            ←
          </button>
          <Field
            label={t("month")}
            preset="code"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setYearMonth((m) => shiftYearMonth(m, 1))}
          >
            →
          </button>
        </div>
        <span className={approved ? TEXT_SUCCESS_CLASS : TEXT_MUTED_CLASS}>
          {approved ? t("statusApproved") : t("statusDraft")}
        </span>
        {view?.roster.copiedFromYearMonth ? (
          <span className={TEXT_MUTED_CLASS}>
            {t("copiedFrom", { month: view.roster.copiedFromYearMonth })}
          </span>
        ) : null}
        <span className={TEXT_MUTED_CLASS}>
          {t("overrideCount", { count: dayOverrides.length })}
        </span>
      </EraListFilterBar>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void postAction("copyPrevious")}
        >
          <Copy className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {t("copyPrevious")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void save()}
        >
          {tc("save")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void postAction("approve")}
        >
          <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {t("approve")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => {
            setAbsenceForm({
              practitionerId: view?.staff[0]?.id ?? "",
              kind: "VACATION",
              startsOn: `${yearMonth}-01`,
              endsOn: `${yearMonth}-01`,
              note: "",
            });
            setAbsenceOpen(true);
          }}
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {t("addAbsence")}
        </button>
      </div>

      {matrixView === "procedures" ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>№</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedure")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("assigned")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("stable")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("warnings")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("overridesForProcedure")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedLines.map((line, idx) => {
                  const rowNum = (page - 1) * pageSize + idx + 1;
                  const lineOverrides = dayOverrides.filter(
                    (o) => o.procedureTypeId === line.procedureTypeId,
                  );
                  const assignedIds = new Set(line.assignees.map((a) => a.practitionerId));
                  return (
                    <tr key={line.procedureTypeId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{rowNum}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {line.procedureName}
                        <span className={`ml-2 text-xs ${TEXT_MUTED_CLASS}`}>
                          {line.procedureCode}
                        </span>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <CatalogField
                          kind="SEARCHABLE"
                          label=""
                          value=""
                          onChange={(v) => addAssignee(line.procedureTypeId, String(v ?? ""))}
                          options={staffOptions.filter((option) => !assignedIds.has(option.value))}
                          emptyLabel={t("addPerson")}
                        />
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {line.assignees.map((person) => {
                            const staff = view?.staff.find((s) => s.id === person.practitionerId);
                            const noSkill =
                              staff &&
                              !staff.skillProcedureTypeIds.includes(line.procedureTypeId);
                            return (
                              <li key={person.practitionerId}>
                                <span
                                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${
                                    noSkill ? "border-red-300" : "border-slate-300"
                                  }`}
                                >
                                  {person.practitionerName ?? person.practitionerId}
                                  <button
                                    type="button"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7F8C8D]"
                                    aria-label={t("removeCabinet")}
                                    onClick={() =>
                                      removeAssignee(line.procedureTypeId, person.practitionerId!)
                                    }
                                  >
                                    ×
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                                    aria-label={t("substitute")}
                                    onClick={() => openSubstitute(line.procedureTypeId)}
                                  >
                                    <ReplaceArrows />
                                  </button>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <input
                          type="checkbox"
                          className={MODAL_CHECKBOX_CLASS}
                          checked={line.stable}
                          onChange={() => toggleStable(line.procedureTypeId)}
                          aria-label={t("stable")}
                        />
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {line.assignees.some((person) => {
                          const staff = view?.staff.find((s) => s.id === person.practitionerId);
                          return staff && !staff.skillProcedureTypeIds.includes(line.procedureTypeId);
                        }) ? (
                          <p className={TEXT_DANGER_CLASS}>{t("noSkill")}</p>
                        ) : null}
                        {line.assignees.flatMap((person) =>
                          person.warnings.map((w, i) => (
                            <p key={`${person.id}-${w.kind}-${i}`} className={TEXT_DANGER_CLASS}>
                              {w.kind}: {w.from}
                              {w.to !== w.from ? `–${w.to}` : ""}
                            </p>
                          )),
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {lineOverrides.length === 0 ? null : (
                          lineOverrides.map((o) => (
                            <p
                              key={o.id}
                              className={`mt-1 flex items-center gap-1 text-xs ${TEXT_MUTED_CLASS}`}
                            >
                              <span>
                                {o.dutyDate}: {o.practitionerName}
                              </span>
                              <button
                                type="button"
                                className={TABLE_ROW_ICON_BTN_CLASS}
                                aria-label={t("substituteDelete")}
                                onClick={() => void removeOverride(o.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </p>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
                {procedureQuery.trim() && procedureRows.length === 0 ? (
                  <tr>
                    <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={6}>
                      {tc("notFound")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={procedureRows.length}
            loading={busy}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            labels={{
              rowsPerPage: tc("rowsPerPage"),
              pageOf: tc("pageOf"),
              prev: tc("prev"),
              next: tc("next"),
            }}
          />
        </div>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("proceduresOwned")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("warnings")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("overridesForProcedure")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedStaff.map((s) => {
                  const owned = lines
                    .filter((l) => l.practitionerId === s.id)
                    .map((l) => l.procedureTypeId);
                  const nurseOverrides = dayOverrides.filter(
                    (o) =>
                      o.practitionerId === s.id ||
                      lines.some(
                        (l) =>
                          l.procedureTypeId === o.procedureTypeId &&
                          l.practitionerId === s.id,
                      ),
                  );
                  return (
                    <tr key={s.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {s.fullName}
                        {kindLabel(s.staffKind) ? (
                          <span className={`ml-2 text-xs ${TEXT_MUTED_CLASS}`}>
                            {kindLabel(s.staffKind)}
                          </span>
                        ) : null}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{s.code}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <CatalogField
                          kind="SEARCHABLE"
                          label=""
                          value=""
                          onChange={(v) => {
                            const id = String(v ?? "");
                            if (!id || owned.includes(id)) return;
                            setNurseProcedures(s.id, [...owned, id]);
                          }}
                          options={procedureOptions.filter((option) => {
                            if (owned.includes(option.value)) return false;
                            const line = lines.find((item) => item.procedureTypeId === option.value);
                            return line ? procedureMatches(line) : true;
                          })}
                          emptyLabel={t("addCabinet")}
                        />
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {owned.filter((id) => {
                            const line = lines.find((item) => item.procedureTypeId === id);
                            return line ? procedureMatches(line) : true;
                          }).map((id) => {
                            const line = lines.find((l) => l.procedureTypeId === id);
                            const overs = dayOverrides.filter((o) => o.procedureTypeId === id);
                            return (
                              <li key={id} className="text-[13px]">
                                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5">
                                  {line?.procedureName ?? id}
                                  <button
                                    type="button"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7F8C8D]"
                                    aria-label={t("removeCabinet")}
                                    onClick={() =>
                                      setNurseProcedures(
                                        s.id,
                                        owned.filter((x) => x !== id),
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                                    aria-label={t("substitute")}
                                    onClick={() => openSubstitute(id)}
                                  >
                                    <ReplaceArrows />
                                  </button>
                                </span>
                                {overs.length === 0 ? null : (
                                  overs.map((o) => (
                                    <button
                                      key={o.id}
                                      type="button"
                                      className={`mt-1 block text-left ${LINK_ACCENT_CLASS}`}
                                      onClick={() => openSubstitute(id, o.dutyDate)}
                                    >
                                      {o.dutyDate} — {o.practitionerName}
                                    </button>
                                  ))
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {s.warnings.map((w, i) => (
                          <p key={`${w.kind}-${i}`} className={TEXT_DANGER_CLASS}>
                            {w.kind}: {w.from}
                            {w.to !== w.from ? `–${w.to}` : ""}
                          </p>
                        ))}
                        {(view?.absences ?? [])
                          .filter((a) => a.practitionerId === s.id)
                          .map((a) => (
                            <p key={a.id} className={TEXT_DANGER_CLASS}>
                              {a.kind} {a.startsOn}–{a.endsOn}
                            </p>
                          ))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {nurseOverrides.map((o) => (
                          <p
                            key={o.id}
                            className={`mt-1 flex items-center gap-1 text-xs ${TEXT_MUTED_CLASS}`}
                          >
                            <span>
                              {o.dutyDate} · {o.procedureCode}: {o.practitionerName}
                            </span>
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("substituteDelete")}
                              onClick={() => void removeOverride(o.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </p>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPaginationFooter
            page={nursePage}
            pageSize={pageSize}
            total={staffRows.length}
            loading={busy}
            onPageChange={setNursePage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setNursePage(1);
            }}
            labels={{
              rowsPerPage: tc("rowsPerPage"),
              pageOf: tc("pageOf"),
              prev: tc("prev"),
              next: tc("next"),
            }}
          />
        </div>
      )}

      <ModalShell
        open={absenceOpen}
        onClose={() => setAbsenceOpen(false)}
        title={t("addAbsence")}
      >
        <div className={FORM_STACK_CLASS}>
          <CatalogField
            kind="SEARCHABLE"
            label={t("assigned")}
            value={absenceForm.practitionerId}
            onChange={(v) =>
              setAbsenceForm((f) => ({ ...f, practitionerId: String(v) }))
            }
            options={staffOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("absenceKind")}
            value={absenceForm.kind}
            onChange={(v) => setAbsenceForm((f) => ({ ...f, kind: String(v) }))}
            options={absenceKindOptions}
            emptyLabel={null}
          />
          <DatePicker
            label={t("startsOn")}
            value={absenceForm.startsOn}
            onChange={(v) => setAbsenceForm((f) => ({ ...f, startsOn: v }))}
            placeholder="dd.mm.yyyy"
          />
          <DatePicker
            label={t("endsOn")}
            value={absenceForm.endsOn}
            onChange={(v) => setAbsenceForm((f) => ({ ...f, endsOn: v }))}
            placeholder="dd.mm.yyyy"
          />
          <Field
            label={t("note")}
            preset="shortText"
            value={absenceForm.note}
            onChange={(e) => setAbsenceForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
        <ModalFooter
          onCancel={() => setAbsenceOpen(false)}
          onSubmit={() => void addAbsence()}
          submitLabel={tc("save")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>

      <ModalShell
        open={subOpen}
        onClose={() => setSubOpen(false)}
        title={t("substituteTitle")}
      >
        <div className={FORM_STACK_CLASS}>
          <CatalogField
            kind="SEARCHABLE"
            label={t("procedure")}
            value={subForm.procedureTypeId}
            onChange={(v) =>
              setSubForm((f) => ({ ...f, procedureTypeId: String(v) }))
            }
            options={procedureOptions}
          />
          <DatePicker
            label={t("substituteDate")}
            value={subForm.dutyDate}
            onChange={(v) => setSubForm((f) => ({ ...f, dutyDate: v }))}
            placeholder="dd.mm.yyyy"
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t("substituteNurse")}
            value={subForm.practitionerId}
            onChange={(v) =>
              setSubForm((f) => ({ ...f, practitionerId: String(v) }))
            }
            options={staffOptions}
          />
          <Field
            label={t("note")}
            preset="shortText"
            value={subForm.note}
            onChange={(e) => setSubForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
        <ModalFooter
          onCancel={() => setSubOpen(false)}
          onSubmit={() => void saveSubstitute()}
          submitLabel={t("substituteSave")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>
    </div>
  );
}
