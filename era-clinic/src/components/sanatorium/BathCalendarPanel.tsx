"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from "@era/satellite-kit/ui";
import { addBakuDays } from "@era/satellite-kit/time";
import { planBathSeries, type BathMode } from "@/domain/planning/bath-calendar";

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

type Snapshot = { days: Day[]; series: Series[]; orders: Order[] };
type WeekCell = { ymd: string; working: boolean; inStay: boolean };
type SeatMember = { procedureCode: string; qty: number };

const MODES = ["2", "3", "5", "ALTERNATING"] as const;

function isMode(value: string): value is BathMode {
  return (MODES as readonly string[]).includes(value);
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

function storedBlock(orders: Order[], codes: Set<string>): string {
  for (const order of orders) {
    if (!codes.has(order.procedureCode)) continue;
    const block = order.physioFields?.dayBlock;
    if (block && isMode(String(block))) return String(block);
  }
  return "";
}

export function BathCalendarPanel({
  episodeId,
  members,
  dayBlock,
  onDayBlockChange,
  previewOnly = false,
}: {
  episodeId: string;
  /** Assigned package + extra sessions for each procedure in the naftalan group. */
  members: SeatMember[];
  /** Shared day block. Empty until the guest's course or the user sets it. */
  dayBlock: string;
  onDayBlockChange: (mode: string) => void;
  /** Form overlay: show the rhythm, do not write sessions that are not saved yet. */
  previewOnly?: boolean;
}) {
  const t = useTranslations("patientRegistry");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [bathSequence, setBathSequence] = useState("");
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
    const stored = storedBlock(snap.orders, codes);
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

  const mode = isMode(dayBlock) ? dayBlock : "";
  const stored = snap ? storedBlock(snap.orders, codes) : "";
  const layout = !stored || stored !== mode ? "fresh" : "continue";

  const preview = useMemo(() => {
    const map = new Map<string, string>();
    if (!snap || !mode) return map;
    const seated = members.filter((row) => row.qty > 0 && seriesByCode.has(row.procedureCode));
    if (seated.length === 0) return map;
    const kept = snap.orders
      .filter((order) => {
        if (!codes.has(order.procedureCode)) return true;
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
    });
    for (const cell of planned) {
      if (!map.has(cell.ymd)) map.set(cell.ymd, cell.mark);
    }
    return map;
  }, [snap, mode, members, seriesByCode, markByCode, codes, layout]);

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
    if (manualRests.includes(ymd)) return "·";
    if (manualBaths.includes(ymd)) return "•";
    const planned = preview.get(ymd);
    if (layout === "fresh" && planned) return planned;
    const order = snap?.orders.find((row) => row.ymd === ymd && codes.has(row.procedureCode));
    if (order) {
      const mark = markByCode.get(order.procedureCode) ?? "";
      const fill = order.physioFields?.naftalanFill;
      if (fill === "OTURAQ") return `${mark} от`;
      if (fill === "TAM") return `${mark} т`;
      return mark;
    }
    return planned ?? "";
  }

  function toggle(cell: WeekCell) {
    if (!cell.inStay || !cell.working) return;
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
    if (!mode || previewOnly) return;
    const seated = members.filter((row) => row.qty >= 1 && seriesByCode.has(row.procedureCode));
    if (seated.length === 0) return;
    setBusy(true);
    try {
      const unplacedDays: string[] = [];
      let unplaced = 0;
      let manualLeft = true;
      for (const member of seated) {
        const sendManual = manualLeft;
        manualLeft = false;
        const res = await fetch(`/api/sanatorium/episodes/${episodeId}/bath-calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            procedureCode: member.procedureCode,
            mode,
            qty: member.qty,
            manualRestYmds: sendManual ? manualRests : [],
            manualBathYmds: sendManual ? manualBaths : [],
            bathSequence: bathSequence === "SITZ_THEN_FULL" ? "SITZ_THEN_FULL" : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, t("bathCalendarFailed"));
          return;
        }
        const saved = (data.data ?? data) as { unplaced?: number; unplacedDays?: string[] };
        unplaced += saved.unplaced ?? 0;
        unplacedDays.push(...(saved.unplacedDays ?? []));
      }
      const dates = unplacedDays.join(", ");
      const skipped = members.some((row) => row.qty >= 1 && !seriesByCode.has(row.procedureCode));
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
      <h4 className="text-sm font-medium">{t("bathCalendarTitle")}</h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("bathCalendarMode")}
          value={dayBlock}
          onChange={(value) => onDayBlockChange(String(value ?? ""))}
          options={[
            { value: "", label: "—" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "5", label: "5" },
            { value: "ALTERNATING", label: t("bathCalendarAlternating") },
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("bathCalendarSitz")}
          value={bathSequence}
          onChange={(value) => setBathSequence(String(value ?? ""))}
          options={[
            { value: "", label: "—" },
            { value: "SITZ_THEN_FULL", label: t("bathCalendarSitz") },
          ]}
        />
        <p className="self-end text-[12px] text-[#7F8C8D]">
          {t("bathCalendarQty")}: {total}
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
              const open = cell.inStay && cell.working;
              const tone = !cell.inStay
                ? "bg-[#F3E6D8] text-[#8B5E3C]"
                : cell.working
                  ? "bg-[#E8F6EF] text-[#1E8449]"
                  : "bg-[#F4F6F7] text-[#95A5A6]";
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  title={cell.ymd}
                  onClick={() => {
                    if (!previewOnly) toggle(cell);
                  }}
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
      {previewOnly ? null : (
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy || !mode || total < 1}
          onClick={() => void save()}
        >
          {t("bathCalendarSave")}
        </button>
      )}
    </section>
  );
}
