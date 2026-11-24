"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { ProcedureLoadMatrixView } from "@/components/sanatorium/ProcedureLoadMatrixView";
import type { ProcedureLoadMatrix } from "@/domain/planning/procedure-load-matrix";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";

export default function SanatoriumProcedureLoadPage() {
  const t = useTranslations("sanatoriumResources");
  const tc = useTranslations("common");
  const [matrix, setMatrix] = useState<ProcedureLoadMatrix | null>(null);
  const [fromYmd, setFromYmd] = useState(() => todayBakuYmd());
  const [toYmd, setToYmd] = useState(() => addBakuDays(todayBakuYmd(), 20));
  const [procedureFilter, setProcedureFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (bypassCache = false) => {
    setBusy(true);
    try {
      const q = new URLSearchParams();
      if (fromYmd) q.set("from", fromYmd);
      if (toYmd) q.set("to", toYmd);
      if (bypassCache) q.set("bust", String(Date.now()));
      const res = await fetch(`/api/sanatorium/procedure-load?${q.toString()}`);
      const body = await res.json().catch(() => ({}));
      const data = body?.data ?? body;
      if (data?.rows && data?.days) setMatrix(data as ProcedureLoadMatrix);
      else setMatrix(null);
    } catch {
      setMatrix(null);
    } finally {
      setBusy(false);
    }
  }, [fromYmd, toYmd]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!matrix) return null;
    const needle = procedureFilter.trim().toLowerCase();
    if (!needle) return matrix;
    return {
      ...matrix,
      rows: matrix.rows.filter(
        (row) =>
          row.procedureCode.toLowerCase().includes(needle) ||
          row.procedureName.toLowerCase().includes(needle),
      ),
    };
  }, [matrix, procedureFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("procedureLoadTitle")}
        subtitle={t("procedureLoadSubtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void load(true)}
          >
            {t("procedureLoadRefresh")}
          </button>
        }
      />
      <EraListFilterBar>
        <DatePicker
          label={t("procedureLoadFrom")}
          value={fromYmd}
          onChange={(iso) => {
            if (iso) setFromYmd(iso);
          }}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <DatePicker
          label={t("procedureLoadTo")}
          value={toYmd}
          onChange={(iso) => {
            if (iso) setToYmd(iso);
          }}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <Field
          label={t("procedureLoadFilter")}
          value={procedureFilter}
          onChange={(e) => setProcedureFilter(e.target.value)}
          placeholder={t("procedureLoadFilterPlaceholder")}
        />
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => {
            const today = todayBakuYmd();
            setFromYmd(today);
            setToYmd(addBakuDays(today, 20));
            setProcedureFilter("");
          }}
        >
          {t("procedureLoadReset")}
        </button>
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <ProcedureLoadMatrixView
          matrix={filtered}
          emptyLabel={t("procedureLoadEmpty")}
          legendLow={t("procedureLoadLow")}
          legendHigh={t("procedureLoadHigh")}
        />
      </div>
    </div>
  );
}
