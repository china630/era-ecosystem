"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  EraDataGrid,
  LIST_PAGE_SHELL_CLASS,
  DatePicker,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
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
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [anchor, setAnchor] = useState("");
  const [slotIds, setSlotIds] = useState<string[]>(["", ""]);
  const [formError, setFormError] = useState<string | null>(null);

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
    setCode("");
    setName("");
    setAnchor("");
    setSlotIds(["", ""]);
    setFormError(null);
    setOpen(true);
  }

  async function saveCycle() {
    if (!code.trim() || !name.trim() || !anchor || slotIds.length < 1) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await wfFetch("shift-cycles", {
      method: "POST",
      body: JSON.stringify({
        code: code.trim(),
        name: name.trim(),
        cycleAnchor: `${anchor}T00:00:00.000Z`,
        slots: slotIds.map((id, i) => ({
          slotIndex: i,
          shiftTypeId: id || null,
        })),
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
        title={t("addCycle")}
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
            onChange={(v) => setCode(String(v))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={name}
            onChange={(v) => setName(String(v))}
            options={[]}
          />
          <DatePicker
            label={t("fieldAnchor")}
            value={anchor}
            onChange={setAnchor}
            placeholder={tCommon("datePlaceholder")}
            fluid
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("fieldSlots")}
            value={String(slotIds.length)}
            onChange={(v) => {
              const n = Math.min(60, Math.max(1, Number(v) || 1));
              setSlotIds((prev) => {
                const next = prev.slice(0, n);
                while (next.length < n) next.push("");
                return next;
              });
            }}
            options={[]}
          />
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
