"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField, Field, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from "@era/satellite-kit/ui";
import { addBakuDays } from "@era/satellite-kit/time";

type Day = { ymd: string; working: boolean; endHour: number };
type Member = { procedureCode: string; shortMark: string };
type Series = { code: string; name: string; members: Member[] };
type Order = {
  id: string;
  procedureCode: string;
  status: string;
  ymd: string;
  note: string | null;
  physioFields?: { naftalanFill?: string | null } | null;
};

type Snapshot = { days: Day[]; series: Series[]; orders: Order[] };
type WeekCell = { ymd: string; working: boolean; inStay: boolean };

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

export function BathCalendarPanel({
  episodeId,
  procedureCode: lockedCode,
}: {
  episodeId: string;
  /** When set, the calendar belongs to this bath row. */
  procedureCode?: string | null;
}) {
  const t = useTranslations("patientRegistry");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [procedureCode, setProcedureCode] = useState(lockedCode ?? "");
  const [mode, setMode] = useState("2");
  const [bathSequence, setBathSequence] = useState("");
  const [qty, setQty] = useState(5);
  const [manualBaths, setManualBaths] = useState<string[]>([]);
  const [manualRests, setManualRests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/bath-calendar`);
    if (!res.ok) {
      setLoadFailed(true);
      setSnap(null);
      return;
    }
    setLoadFailed(false);
    const json = await res.json();
    const data = (json.data ?? json) as Snapshot;
    setSnap(data);
    const first = lockedCode || data.series[0]?.members[0]?.procedureCode || "";
    setProcedureCode(first);
  }, [episodeId, lockedCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(
    () =>
      (snap?.series ?? []).flatMap((series) =>
        series.members.map((member) => ({
          value: member.procedureCode,
          label: `${member.shortMark} · ${member.procedureCode}`,
        })),
      ),
    [snap],
  );

  const weeks = useMemo(() => stayWeeks(snap?.days ?? []), [snap]);
  const weekdayLabels = t("bathCalendarWeekdays").split(",");

  const markByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const series of snap?.series ?? []) {
      for (const member of series.members) map.set(member.procedureCode, member.shortMark);
    }
    return map;
  }, [snap]);

  if (!lockedCode && !procedureCode) return null;

  const inSeries =
    !lockedCode ||
    (snap?.series ?? []).some((series) =>
      series.members.some((member) => member.procedureCode === lockedCode),
    );
  const blockedReason = loadFailed
    ? t("bathCalendarLoadFailed")
    : !snap
      ? null
      : snap.series.length === 0
        ? t("bathCalendarNoSeries")
        : snap.days.length === 0
          ? t("bathCalendarNoStay")
          : lockedCode && !inSeries
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
    if (manualBaths.includes(ymd)) return markByCode.get(procedureCode) ?? "•";
    const order = snap?.orders.find((row) => row.ymd === ymd);
    if (!order) return "";
    const mark = markByCode.get(order.procedureCode) ?? "";
    const fill = order.physioFields?.naftalanFill;
    if (fill === "OTURAQ") return `${mark} от`;
    if (fill === "TAM") return `${mark} т`;
    return mark;
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
    setBusy(true);
    try {
      const res = await fetch(`/api/sanatorium/episodes/${episodeId}/bath-calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureCode,
          mode,
          qty,
          manualRestYmds: manualRests,
          manualBathYmds: manualBaths,
          bathSequence: bathSequence === "SITZ_THEN_FULL" ? "SITZ_THEN_FULL" : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("bathCalendarFailed"));
        return;
      }
      const saved = (data.data ?? data) as { unplaced?: number; unplacedDays?: string[] };
      const dates = (saved.unplacedDays ?? []).join(", ");
      showSuccess(
        saved.unplaced
          ? t("bathCalendarUnplaced", { count: saved.unplaced, dates: dates || "—" })
          : t("bathCalendarSaved"),
      );
      setManualBaths([]);
      setManualRests([]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-3 space-y-2 rounded-lg border border-[#D5DADF] p-3">
      <h4 className="text-sm font-medium">{t("bathCalendarTitle")}</h4>
      <div className={`grid gap-2 sm:grid-cols-2 ${lockedCode ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {lockedCode ? null : (
        <CatalogField
          kind="SEARCHABLE"
          label={t("bathCalendarProcedure")}
          value={procedureCode}
          onChange={(value) => setProcedureCode(String(value ?? ""))}
          options={options}
        />
        )}
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("bathCalendarMode")}
          value={mode}
          onChange={(value) => setMode(String(value ?? "2"))}
          options={[
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
        <Field
          preset="count"
          label={t("bathCalendarQty")}
          type="number"
          min={0}
          max={60}
          value={qty}
          onChange={(event) => setQty(Number(event.target.value) || 0)}
        />
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
      <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || !procedureCode} onClick={() => void save()}>
        {t("bathCalendarSave")}
      </button>
    </section>
  );
}
