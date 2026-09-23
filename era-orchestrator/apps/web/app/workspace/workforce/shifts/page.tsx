"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import {
  CatalogField,
  EraDataGrid,
  LIST_PAGE_SHELL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../components/workspace/workforce-shifts-subnav";
import { fmtMinutes, type ShiftType } from "./_lib/types";

function minutesToHm(m: number): string {
  const h = Math.floor(Math.max(0, m) / 60);
  const min = Math.max(0, m) % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function hmToMinutes(raw: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return 0;
  return Math.min(1440, Number(m[1]) * 60 + Number(m[2]));
}

export default function WorkforceShiftTypesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [types, setTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startHm, setStartHm] = useState("08:00");
  const [endHm, setEndHm] = useState("16:00");
  const [hours, setHours] = useState("8");
  const [night, setNight] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tRes = await wfFetch("shift-types");
    if (await isWorkforceGate403(tRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (tRes.ok) setTypes(await tRes.json());
    else setError(t("loadError"));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  function openCreate() {
    setEditId(null);
    setCode("");
    setName("");
    setStartHm("08:00");
    setEndHm("16:00");
    setHours("8");
    setNight(false);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: ShiftType) {
    setEditId(row.id);
    setCode(row.code);
    setName(row.name);
    setStartHm(minutesToHm(row.startMinute));
    setEndHm(minutesToHm(row.endMinute));
    setHours(String(row.defaultHours));
    setNight(row.isNight);
    setFormError(null);
    setOpen(true);
  }

  async function ensureDefaults() {
    setBusy(true);
    await wfFetch("roster/ensure-defaults", { method: "POST", body: "{}" });
    setBusy(false);
    await load();
  }

  async function saveShift() {
    if (!name.trim() || (!editId && !code.trim())) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const payload = {
      name: name.trim(),
      startMinute: hmToMinutes(startHm),
      endMinute: hmToMinutes(endHm),
      isNight: night,
      defaultHours: Number(hours) || 0,
      ...(editId ? {} : { code: code.trim() }),
    };
    const res = await wfFetch(editId ? `shift-types/${editId}` : "shift-types", {
      method: editId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(t("saveError"));
      return;
    }
    setOpen(false);
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("shiftsTitle")}
          subtitle={t("shiftsHint")}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void ensureDefaults()}
              >
                {t("seedDefaults")}
              </button>
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                {t("addShift")}
              </button>
            </div>
          }
        />
      </div>
      <div className="shrink-0">
        <WorkforceShiftsSubnav />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <EraDataGrid
          layout="fill"
          columns={[
            { key: "code", header: t("colCode") },
            { key: "name", header: t("colName") },
            {
              key: "window",
              header: t("colWindow"),
              render: (row) => (
                <>
                  {fmtMinutes(row.startMinute)}–{fmtMinutes(row.endMinute)}
                  {row.isNight ? ` (${t("night")})` : ""}
                </>
              ),
            },
            {
              key: "hours",
              header: t("colHours"),
              render: (row) => String(row.defaultHours),
            },
            {
              key: "actions",
              header: "",
              className: "w-12",
              render: (row) => (
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  title={t("editShift")}
                  aria-label={t("editShift")}
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              ),
            },
          ]}
          rows={types}
          rowKey={(row) => row.id}
          emptyMessage={loading ? tCommon("loading") : t("shiftsEmpty")}
          paginationLabels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>

      <ModalShell
        open={open}
        title={editId ? t("editShift") : t("addShift")}
        onClose={() => setOpen(false)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={() => void saveShift()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="grid gap-3">
          {!editId ? (
            <CatalogField
              kind="FREE_TEXT"
              label={t("colCode")}
              value={code}
              onChange={(v) => setCode(String(v))}
              options={[]}
            />
          ) : null}
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={name}
            onChange={(v) => setName(String(v))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldStart")}
            value={startHm}
            onChange={(v) => setStartHm(String(v))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldEnd")}
            value={endHm}
            onChange={(v) => setEndHm(String(v))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldHours")}
            value={hours}
            onChange={(v) => setHours(String(v))}
            options={[]}
          />
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              checked={night}
              onChange={(e) => setNight(e.target.checked)}
            />
            {t("fieldNight")}
          </label>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
