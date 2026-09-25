"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import {
  CatalogField,
  EraDataGrid,
  LIST_PAGE_SHELL_CLASS,
  DatePicker,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
import { bakuDateKey } from "@era/satellite-kit/time";
import { cycleTape, type Cycle, type ShiftType } from "../_lib/types";

export default function WorkforceShiftCyclesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [types, setTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [anchor, setAnchor] = useState("");
  const [slotIds, setSlotIds] = useState<string[]>(["", ""]);
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [anchorError, setAnchorError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cRes, tRes] = await Promise.all([
      wfFetch("shift-cycles"),
      wfFetch("shift-types"),
    ]);
    if (await isWorkforceGate403(cRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (cRes.ok) setCycles(await cRes.json());
    else setError(t("loadError"));
    if (tRes.ok) setTypes(await tRes.json());
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const cycleSummaries = useMemo(
    () =>
      cycles.map((c) => ({
        ...c,
        tape: cycleTape(c.slots),
      })),
    [cycles],
  );

  const typeOptions = useMemo(
    () => types.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
    [types],
  );

  function openCreate() {
    setEditId(null);
    setCode("");
    setName("");
    setAnchor("");
    setSlotIds(["", ""]);
    setFormError(null);
    setCodeError(false);
    setAnchorError(false);
    setOpen(true);
  }

  function openEdit(row: Cycle) {
    const sorted = [...(row.slots ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
    setEditId(row.id);
    setCode(row.code);
    setName(row.name);
    setAnchor(bakuDateKey(row.cycleAnchor));
    setSlotIds(sorted.length ? sorted.map((s) => s.shiftTypeId ?? "") : [""]);
    setFormError(null);
    setCodeError(false);
    setAnchorError(false);
    setOpen(true);
  }

  async function saveCycle() {
    const missingCode = !editId && !code.trim();
    const missingAnchor = !anchor;
    setCodeError(missingCode);
    setAnchorError(missingAnchor);
    if (missingCode || missingAnchor || !name.trim() || slotIds.length < 1) {
      setFormError(
        missingCode
          ? t("requiredCode")
          : missingAnchor
            ? t("requiredAnchor")
            : t("requiredFields"),
      );
      return;
    }
    if (slotIds.every((id) => !id)) {
      setFormError(t("cycleAllOff"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const slots = slotIds.map((id, i) => ({
      slotIndex: i,
      shiftTypeId: id || null,
    }));
    const res = editId
      ? await wfFetch(`shift-cycles/${editId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            cycleAnchor: anchor,
            slots,
          }),
        })
      : await wfFetch("shift-cycles", {
          method: "POST",
          body: JSON.stringify({
            code: code.trim(),
            name: name.trim(),
            cycleAnchor: anchor,
            slots,
          }),
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
          title={t("cyclesHeading")}
          subtitle={t("cyclesHint")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addCycle")}
            </button>
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
            { key: "tape", header: t("colTape") },
            {
              key: "actions",
              header: "",
              className: "w-12",
              render: (row) => (
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  onClick={() => openEdit(row)}
                  aria-label={tCommon("edit")}
                  title={tCommon("edit")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ),
            },
          ]}
          rows={cycleSummaries}
          rowKey={(row) => row.id}
          emptyMessage={loading ? tCommon("loading") : t("cyclesEmpty")}
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
        title={editId ? t("editCycle") : t("addCycle")}
        onClose={() => setOpen(false)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={() => void saveCycle()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="grid gap-3">
          <CatalogField
            kind="FREE_TEXT"
            label={t("colCode")}
            value={code}
            onChange={(v) => {
              setCode(String(v));
              setCodeError(false);
            }}
            options={[]}
            disabled={Boolean(editId)}
          />
          {codeError ? <p className="text-xs text-red-600">{t("requiredCode")}</p> : null}
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={name}
            onChange={(v) => setName(String(v))}
            options={[]}
          />
          <div className="grid grid-cols-2 items-end gap-3">
            <DatePicker
              label={t("fieldAnchor")}
              value={anchor}
              onChange={(v) => {
                setAnchor(v);
                setAnchorError(false);
              }}
              placeholder={tCommon("datePlaceholder")}
              fluid
            />
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[#34495E]">
                {t("fieldSlots")}
              </span>
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                className="h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
                value={slotIds.length}
                onChange={(e) => {
                  const n = Math.min(60, Math.max(1, Number(e.target.value) || 1));
                  setSlotIds((prev) => {
                    const next = prev.slice(0, n);
                    while (next.length < n) next.push("");
                    return next;
                  });
                }}
              />
            </label>
          </div>
          {anchorError ? <p className="text-xs text-red-600">{t("requiredAnchor")}</p> : null}
          {slotIds.map((id, i) => (
            <CatalogField
              key={i}
              kind="ENTITY_REF"
              label={`${i + 1}`}
              value={id}
              onChange={(v) =>
                setSlotIds((prev) => prev.map((x, idx) => (idx === i ? String(v) : x)))
              }
              options={typeOptions}
              emptyLabel={t("slotOff")}
            />
          ))}
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
