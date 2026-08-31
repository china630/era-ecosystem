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
  Field,
  FORM_STACK_CLASS,
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
  skillProcedureTypeIds: string[];
  warnings: Warning[];
};

type Absence = {
  id: string;
  practitionerId: string;
  kind: string;
  startsOn: string;
  endsOn: string;
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
};

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
  const tc = useTranslations("common");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [staffKind, setStaffKind] = useState<"NURSE" | "LAB">("NURSE");
  const [view, setView] = useState<RosterView | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    practitionerId: "",
    kind: "VACATION",
    startsOn: "",
    endsOn: "",
    note: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedLines = useMemo(() => {
    const start = (page - 1) * pageSize;
    return lines.slice(start, start + pageSize);
  }, [lines, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [yearMonth, staffKind, pageSize]);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/sanatorium/nurse-roster?yearMonth=${yearMonth}&staffKind=${staffKind}`,
      );
      const data = (await res.json()) as RosterView & { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? t("loadFailed"));
        return;
      }
      setView(data);
      setLines(data.lines);
      setPage(1);
    } finally {
      setBusy(false);
    }
  }, [yearMonth, staffKind, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffOptions = useMemo(
    () => [
      { value: "", label: t("unassigned") },
      ...(view?.staff ?? []).map((s) => ({
        value: s.id,
        label: s.specialty ? `${s.fullName} (${s.specialty})` : s.fullName,
      })),
    ],
    [view?.staff, t],
  );

  const kindOptions = useMemo(
    () => [
      { value: "NURSE", label: t("kindNurse") },
      { value: "LAB", label: t("kindLab") },
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

  function setLineNurse(procedureTypeId: string, practitionerId: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.procedureTypeId === procedureTypeId
          ? {
              ...l,
              practitionerId: practitionerId || null,
              practitionerName:
                view?.staff.find((s) => s.id === practitionerId)?.fullName ?? null,
            }
          : l,
      ),
    );
  }

  function toggleStable(procedureTypeId: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.procedureTypeId === procedureTypeId ? { ...l, stable: !l.stable } : l,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setMsg(null);
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
        setMsg(data.error ?? t("saveFailed"));
        return;
      }
      setView(data);
      setLines(data.lines);
      setMsg(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function postAction(action: "approve" | "copyPrevious") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sanatorium/nurse-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, yearMonth, staffKind }),
      });
      const data = (await res.json()) as RosterView & { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? t("saveFailed"));
        return;
      }
      setView(data);
      setLines(data.lines);
      setPage(1);
      setMsg(action === "approve" ? t("approved") : t("copied"));
    } finally {
      setBusy(false);
    }
  }

  async function addAbsence() {
    if (!absenceForm.practitionerId || !absenceForm.startsOn || !absenceForm.endsOn) {
      setMsg(t("absenceRequired"));
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
        setMsg(data.error ?? t("saveFailed"));
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

  const approved = view?.roster.status === "APPROVED";

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap items-end gap-3">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("staffKind")}
          value={staffKind}
          onChange={(v) => setStaffKind(String(v) === "LAB" ? "LAB" : "NURSE")}
          options={kindOptions}
          emptyLabel={null}
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
      </div>

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

      {msg ? <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}

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
              </tr>
            </thead>
            <tbody>
              {pagedLines.map((line, idx) => {
                const staff = view?.staff.find((s) => s.id === line.practitionerId);
                const noSkill =
                  staff && !staff.skillProcedureTypeIds.includes(line.procedureTypeId);
                const rowNum = (page - 1) * pageSize + idx + 1;
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
                        value={line.practitionerId ?? ""}
                        onChange={(v) => setLineNurse(line.procedureTypeId, String(v))}
                        options={staffOptions}
                        emptyLabel={null}
                      />
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
                      {noSkill ? (
                        <p className={TEXT_DANGER_CLASS}>{t("noSkill")}</p>
                      ) : null}
                      {line.warnings.map((w, i) => (
                        <p key={`${w.kind}-${i}`} className={TEXT_DANGER_CLASS}>
                          {w.kind}: {w.from}
                          {w.to !== w.from ? `–${w.to}` : ""}
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
          page={page}
          pageSize={pageSize}
          total={lines.length}
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

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-medium">{t("staffList")}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("absences")}</th>
              </tr>
            </thead>
            <tbody>
              {(view?.staff ?? []).map((s) => (
                <tr key={s.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{s.fullName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{s.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {(view?.absences ?? [])
                      .filter((a) => a.practitionerId === s.id)
                      .map((a) => (
                        <span key={a.id} className="mr-2 inline-flex items-center gap-1">
                          <span className={TEXT_DANGER_CLASS}>
                            {a.kind} {a.startsOn}–{a.endsOn}
                          </span>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={tc("delete")}
                            onClick={() => void removeAbsence(a.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      ))}
                    {s.warnings.some((w) => w.kind === "DAY_OFF") ? (
                      <span className={TEXT_MUTED_CLASS}>{t("hasDayOff")}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
            options={(view?.staff ?? []).map((s) => ({
              value: s.id,
              label: s.fullName,
            }))}
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
    </div>
  );
}
