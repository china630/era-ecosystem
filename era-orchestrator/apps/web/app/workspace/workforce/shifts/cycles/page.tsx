"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
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
    <div className="space-y-4">
      <PageHeader
        title={t("cyclesHeading")}
        subtitle={t("shiftsHint")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addCycle")}
          </button>
        }
      />
      <WorkforceShiftsSubnav />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--era-muted)]">{tCommon("loading")}</p>
      ) : (
        <section className={CARD_CONTAINER_CLASS}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTape")}</th>
                </tr>
              </thead>
              <tbody>
                {cycleSummaries.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.tape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
