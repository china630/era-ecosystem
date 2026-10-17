"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from "@era/satellite-kit/ui";
import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";
import { planBathSeries, type BathModeDef } from "@/domain/planning/bath-calendar";

type Day = { ymd: string; working: boolean; endHour: number };
type Member = { procedureCode: string; shortMark: string };
type Series = { code: string; name: string; fillsRestDays?: boolean; members: Member[] };
type Order = {
  id: string;
  procedureCode: string;
  status: string;
  ymd: string;
  note: string | null;
  physioFields?: { naftalanFill?: string | null; dayBlock?: string | null } | null;
};

type Snapshot = { days: Day[]; series: Series[]; orders: Order[]; modes?: BathModeDef[] };
type WeekCell = { ymd: string; working: boolean; inStay: boolean };
type SeatMember = { procedureCode: string; qty: number };

const FALLBACK_MODES: BathModeDef[] = [
  { code: "2", baths: 2, rest: 1 },
  { code: "3", baths: 3, rest: 1 },
  { code: "4", baths: 4, rest: 1 },
  { code: "5", baths: 5, rest: 1 },
  { code: "ALTERNATING", baths: 1, rest: 1 },
];

function isMode(value: string, modes: BathModeDef[]): boolean {
  return modes.some((row) => row.code === value);
}

/** Monday = 0 … Sunday = 6 in Asia/Baku. */
function mondayIndex(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  const noon = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baku", weekday: "short" }).format(noon);
  const index: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return index[short] ?? 0;
}

/** Stay days padded to whole Monday–Sunday weeks. Days outside the stay are only there to keep the week. */
function stayWeeks(days: Day[]): WeekCell[][] {
  if (days.length === 0) return [];
  const sorted = [...days].sort((a, b) => a.ymd.localeCompare(b.ymd));
  const byYmd = new Map(sorted.map((day) => [day.ymd, day]));
  const first = sorted[0]!.ymd;
  const last = sorted[sorted.length - 1]!.ymd;
  let cursor = addBakuDays(first, -mondayIndex(first));
  const end = addBakuDays(last, 6 - mondayIndex(last));
  const cells: WeekCell[] = [];
  while (cursor <= end) {
    const day = byYmd.get(cursor);
    cells.push(day ? { ymd: cursor, working: day.working, inStay: true } : { ymd: cursor, working: false, inStay: false });
    cursor = addBakuDays(cursor, 1);
  }
  const weeks: WeekCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

function storedBlock(orders: Order[], codes: Set<string>, modes: BathModeDef[]): string {
  for (const order of orders) {
    if (!codes.has(order.procedureCode)) continue;
    const block = order.physioFields?.dayBlock;
    if (block && isMode(String(block), modes)) return String(block);
  }
  return "";
}

export function BathCalendarPanel({
  episodeId,
  members,
  dayBlock,
  onDayBlockChange,
  onNeedsWriteChange,
}: {
  episodeId: string;
  /** Assigned package + extra sessions for each procedure in the naftalan group. */
  members: SeatMember[];
  /** Shared day block. Empty until the guest's course or the user sets it. */
  dayBlock: string;
  onDayBlockChange: (mode: string) => void;
  /** True when package Saxla must wait for a day block or for calendar Plana yaz. */
  onNeedsWriteChange?: (needsWrite: boolean) => void;
}) {
  const t = useTranslations("patientRegistry");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [manualBaths, setManualBaths] = useState<string[]>([]);
  const [manualRests, setManualRests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/bath-calendar`);
    if (!res.ok) {
      setLoadFailed(true);
      setSnap(null);
      return;
    }
    setLoadFailed(false);
    const json = await res.json();
    setSnap((json.data ?? json) as Snapshot);
  }, [episodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const codes = useMemo(() => new Set(members.map((row) => row.procedureCode)), [members]);

  useEffect(() => {
    if (!snap || hydrated || dayBlock) return;
    const modes = snap.modes?.length ? snap.modes : FALLBACK_MODES;
    const stored = storedBlock(snap.orders, codes, modes);
    if (stored) onDayBlockChange(stored);
    setHydrated(true);
  }, [snap, hydrated, dayBlock, codes, onDayBlockChange]);

  const weeks = useMemo(() => stayWeeks(snap?.days ?? []), [snap]);
  const weekdayLabels = t("bathCalendarWeekdays").split(",");

  const markByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const series of snap?.series ?? []) {
      for (const member of series.members) map.set(member.procedureCode, member.shortMark);
    }
    return map;
  }, [snap]);

  const seriesByCode = useMemo(() => {
    const map = new Map<string, Series>();
    for (const series of snap?.series ?? []) {
      for (const member of series.members) map.set(member.procedureCode, series);
    }
    return map;
  }, [snap]);

  const modes = snap?.modes?.length ? snap.modes : FALLBACK_MODES;
  const mode = isMode(dayBlock, modes) ? dayBlock : "";
  const stored = snap ? storedBlock(snap.orders, codes, modes) : "";
  const layout = !stored || stored !== mode ? "fresh" : "continue";
  const memberQty = members.reduce((sum, row) => sum + Math.max(0, row.qty), 0);
  const seatedQty = members
    .filter((row) => row.qty > 0 && seriesByCode.has(row.procedureCode))
    .reduce((sum, row) => sum + row.qty, 0);

  const preview = useMemo(() => {
    const map = new Map<string, string>();
    if (!snap || !mode) return map;
    const seated = members.filter((row) => row.qty > 0 && seriesByCode.has(row.procedureCode));
    if (seated.length === 0) return map;
    const today = todayBakuYmd();
    const kept = snap.orders
      .filter((order) => {
        if (!codes.has(order.procedureCode)) return true;
        if (order.ymd < today) return true;
        if (layout === "continue") return true;
        return order.status === "CHECKED_IN" || order.status === "COMPLETED";
      })
      .map((order) => ({
        ymd: order.ymd,
        procedureCode: order.procedureCode,
        locked: true,
        anchor: codes.has(order.procedureCode),
      }));
    const planned = planBathSeries({
      days: snap.days,
      series: seated.map((row) => {
        const series = seriesByCode.get(row.procedureCode)!;
        return {
          seriesCode: series.code,
          procedureCode: row.procedureCode,
          mark: markByCode.get(row.procedureCode) ?? "",
          mode,
          qty: row.qty,
          fillsRestDays: Boolean(series.fillsRestDays),
        };
      }),
      kept,
      layout,
      modes,
      notBeforeYmd: today,
    });
    for (const cell of planned) {
      if (!map.has(cell.ymd)) map.set(cell.ymd, cell.mark);
    }
    return map;
  }, [snap, mode, members, seriesByCode, markByCode, codes, layout, modes]);

  const savedCount = snap
    ? snap.orders.filter((order) => codes.has(order.procedureCode)).length
    : 0;

  useEffect(() => {
    if (!onNeedsWriteChange) return;
    if (memberQty < 1) {
      onNeedsWriteChange(false);
      return;
    }
    if (loadFailed) {
      onNeedsWriteChange(false);
      return;
    }
    if (!snap) {
      onNeedsWriteChange(true);
      return;
    }
    if (seatedQty < 1) {
      onNeedsWriteChange(false);
      return;
    }
    const manuals = manualBaths.length > 0 || manualRests.length > 0;
    const dirtySaved =
      savedCount > 0 && (layout === "fresh" || manuals || savedCount < seatedQty);
    onNeedsWriteChange(!mode || dirtySaved);
  }, [
    onNeedsWriteChange,
    memberQty,
    seatedQty,
    mode,
    layout,
    savedCount,
    loadFailed,
    snap,
    manualBaths,
    manualRests,
  ]);

  if (members.length === 0) return null;

  const inSeries =
    !snap ||
    members.some((row) => seriesByCode.has(row.procedureCode));
  const blockedReason = loadFailed
    ? t("bathCalendarLoadFailed")
    : !snap
      ? null
      : snap.series.length === 0
        ? t("bathCalendarNoSeries")
        : snap.days.length === 0
          ? t("bathCalendarNoStay")
          : !inSeries
            ? t("bathCalendarNotInSeries")
            : null;

  if (blockedReason) {
    return (
      <section className="mb-3 rounded-lg border border-[#D5DADF] p-3">
        <h4 className="text-sm font-medium">{t("bathCalendarTitle")}</h4>
        <p className="mt-1 text-[12px] text-[#7F8C8D]">{blockedReason}</p>
      </section>
    );
  }

  if (!snap || snap.series.length === 0 || snap.days.length === 0) return null;

  function cellMark(ymd: string): string {
    const planned = preview.get(ymd);
    const order = snap?.orders.find((row) => row.ymd === ymd && codes.has(row.procedureCode));
    let base = "";
    if (order && ymd < todayBakuYmd()) {
      const mark = markByCode.get(order.procedureCode) ?? "";
      const fill = order.physioFields?.naftalanFill;
      if (fill === "OTURAQ") base = `${mark} от`;
      else if (fill === "TAM") base = `${mark} т`;
      else base = mark;
    } else if (layout === "fresh") base = planned ?? "";
    else if (order) {
      const mark = markByCode.get(order.procedureCode) ?? "";
      const fill = order.physioFields?.naftalanFill;
      if (fill === "OTURAQ") base = `${mark} от`;
      else if (fill === "TAM") base = `${mark} т`;
      else base = mark;
    } else base = planned ?? "";
    if (ymd >= todayBakuYmd() && manualRests.includes(ymd)) return "İst";
    if (ymd >= todayBakuYmd() && manualBaths.includes(ymd)) return base ? `${base}+` : "+";
    return base;
  }

  function toggle(cell: WeekCell) {
    if (!cell.inStay || !cell.working || cell.ymd < todayBakuYmd()) return;
    const ymd = cell.ymd;
    if (manualRests.includes(ymd)) {
      setManualRests((rests) => rests.filter((row) => row !== ymd));
      return;
    }
    if (manualBaths.includes(ymd)) {
      setManualBaths((baths) => baths.filter((row) => row !== ymd));
      setManualRests((rests) => (rests.includes(ymd) ? rests : [...rests, ymd]));
      return;
    }
    setManualBaths((baths) => (baths.includes(ymd) ? baths : [...baths, ymd]));
  }

  async function save() {
    if (!mode) return;
    const toSeat = members.filter((row) => row.qty >= 1 && seriesByCode.has(row.procedureCode));
    if (toSeat.length === 0) return;
    setBusy(true);
    try {
      const unplacedDays: string[] = [];
      let unplaced = 0;
      let seatedCount = 0;
      let planned = 0;
      let manualLeft = true;
      for (const member of toSeat) {
        const sendManual = manualLeft;
        manualLeft = false;
        const res = await fetch(`/api/sanatorium/episodes/${episodeId}/bath-calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            procedureCode: member.procedureCode,
            mode,
            qty: member.qty,
            manualRestYmds: sendManual ? manualRests.filter((ymd) => ymd >= todayBakuYmd()) : [],
            manualBathYmds: sendManual ? manualBaths.filter((ymd) => ymd >= todayBakuYmd()) : [],
            bathSequence: null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, t("bathCalendarFailed"));
          return;
        }
        const saved = (data.data ?? data) as {
          seated?: number;
          planned?: number;
          unplaced?: number;
          unplacedDays?: string[];
        };
        seatedCount += saved.seated ?? 0;
        planned += saved.planned ?? 0;
        unplaced += saved.unplaced ?? 0;
        unplacedDays.push(...(saved.unplacedDays ?? []));
      }
      const dates = unplacedDays.join(", ");
      const skipped = members.some((row) => row.qty >= 1 && !seriesByCode.has(row.procedureCode));
      if (seatedCount < 1 && planned < 1) {
        showApiError({ error: t("bathCalendarNothingToSeat") });
        return;
      }
      showSuccess(
        unplaced
          ? t("bathCalendarUnplaced", { count: unplaced, dates: dates || "—" })
          : t("bathCalendarSaved"),
      );
      if (skipped) showSuccess(t("bathCalendarNotInSeries"));
      setManualBaths([]);
      setManualRests([]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const total = members.reduce((sum, row) => sum + Math.max(0, row.qty), 0);

  return (
    <section className="mb-3 space-y-2 rounded-lg border border-[#D5DADF] p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium">{t("bathCalendarTitle")}</h4>
        <p className="text-[13px] font-semibold">
          {t("bathCalendarTotal")}: {total}
        </p>
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#7F8C8D]">
          {weekdayLabels.map((label, index) => (
            <span key={index} className="min-w-0 truncate">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.ymd} className="grid grid-cols-7 gap-1">
            {week.map((cell) => {
              const mark = cell.inStay ? cellMark(cell.ymd) : "";
              const past = cell.inStay && cell.ymd < todayBakuYmd();
              const open = cell.inStay && cell.working && !past;
              const tone = !cell.inStay
                ? "bg-[#F3E6D8] text-[#8B5E3C]"
                : past
                  ? "bg-[#F8E4E6] text-[#A56B73]"
                : cell.working
                  ? "bg-[#E8F6EF] text-[#1E8449]"
                  : "bg-[#F4F6F7] text-[#95A5A6]";
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  title={past ? t("bathCalendarPastDay") : cell.ymd}
                  disabled={!open}
                  onClick={() => toggle(cell)}
                  className={`min-h-8 min-w-0 w-full overflow-hidden rounded px-0.5 text-[11px] leading-tight ${tone} ${open ? "" : "pointer-events-none"}`}
                >
                  {cell.ymd.slice(8)}
                  {mark ? ` ${mark}` : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[12px]">{t("bathCalendarMode")}</span>
          <div className="w-[11rem]">
            <CatalogField
              kind="CLOSED_SMALL"
              label=""
              value={dayBlock}
              emptyLabel="—"
              onChange={(value) => onDayBlockChange(String(value ?? ""))}
              options={modes.map((row) => ({
                value: row.code,
                label: row.code === "ALTERNATING" ? t("bathCalendarAlternating") : row.code,
              }))}
            />
          </div>
        </div>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy || !mode || total < 1}
          onClick={() => void save()}
        >
          {t("bathCalendarSave")}
        </button>
      </div>
    </section>
  );
}
