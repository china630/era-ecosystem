"use client";

import { useLocale } from "next-intl";
import { TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@/lib/baku-day";
import type { StayPlan, StayPlanMark } from "@/domain/sanatorium/package-assign.service";
import { stripLatinParamEcho } from "@/components/physio/physio-params-label";
import {
  STAY_PLAN_DONE_RING_CLASS,
  STAY_PLAN_MONEY_DOT_CLASS,
  pickStayPlanMarkForDay,
  stayPlanDotClass,
  stayPlanMarksForDay,
} from "@/components/sanatorium/stay-plan-mark-tone";
import {
  STAY_DAY_SLOTS,
  stayMonthSpans,
  stayMonthTitle,
  stayWindowDays,
} from "@/domain/sanatorium/stay-day-axis";

export { STAY_DAY_SLOTS, stayMonthSpans, stayMonthTitle, stayWindowDays } from "@/domain/sanatorium/stay-day-axis";

type Row = {
  key: string;
  procedureCode: string;
  regimeKey: string;
  procedureName: string;
  paramsLabel: string;
  marks: StayPlanMark[];
};

function bakuNoon(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 8));
}

function isBakuSunday(ymd: string): boolean {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baku", weekday: "short" }).format(
      bakuNoon(ymd),
    ) === "Sun"
  );
}

export function StayDayGrid({
  plan,
  focusKey,
  onFocus,
  emptyLabel,
  openLabel,
  noonLabel,
  legendPackage,
  legendUnpaidExtra,
  legendPaid,
  legendDone,
  dayColumns,
  ownScroll = true,
  showLegend = true,
  /** When false, skip month/day thead (parent already showed axis above). */
  showDayHeaders = true,
}: {
  plan: StayPlan;
  focusKey: string | null;
  onFocus: (procedureCode: string, regimeKey: string) => void;
  emptyLabel: string;
  openLabel: string;
  noonLabel: string;
  legendPackage: string;
  legendUnpaidExtra: string;
  legendPaid: string;
  legendDone: string;
  /** Shared axis with heat (defaults to stay window). */
  dayColumns?: string[];
  /** False when parent owns horizontal/vertical scroll with the heat strip. */
  ownScroll?: boolean;
  showLegend?: boolean;
  showDayHeaders?: boolean;
}) {
  const locale = useLocale();
  const rows = new Map<string, Row>();
  for (const mark of plan.marks) {
    const key = `${mark.procedureCode}:${mark.regimeKey}`;
    const row = rows.get(key) ?? {
      key,
      procedureCode: mark.procedureCode,
      regimeKey: mark.regimeKey,
      procedureName: mark.procedureName,
      paramsLabel: stripLatinParamEcho(mark.paramsLabel ?? ""),
      marks: [],
    };
    row.marks.push(mark);
    rows.set(key, row);
  }
  const list = [...rows.values()];
  const days = dayColumns?.length ? dayColumns : stayWindowDays(plan);
  if (days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const checkIn = plan.days[0]!;
  const checkout = plan.checkoutYmd ?? plan.days[plan.days.length - 1]!;
  const today = todayBakuYmd();
  const todayMark = "shadow-[inset_1px_0_0_0_#1F4E79,inset_-1px_0_0_0_#1F4E79]";
  const monthSpans = stayMonthSpans(days);

  const tableBlock = (
    <>
      <div style={{ width: `calc(9rem + (100% - 9rem) * ${days.length} / ${STAY_DAY_SLOTS})` }}>
        <table className="w-full table-fixed border-separate border-spacing-0 text-[12px]">
          {showDayHeaders ? (
            <thead className="sticky top-0 z-30 bg-white">
              <tr>
                <th className="sticky left-0 z-20 w-36 bg-white" />
                {monthSpans.map((group) => (
                  <th
                    key={group.ymd.slice(0, 7)}
                    colSpan={group.span}
                    className="px-0.5 py-1 text-center text-[12px] font-semibold text-[#2C3E50]"
                  >
                    {stayMonthTitle(group.ymd, locale)}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 w-36 bg-white" />
                {days.map((ymd) => {
                  const day = ymd.slice(8);
                  const tone = dayTone(ymd, checkIn, checkout, today);
                  return (
                    <th
                      key={ymd}
                      className={`px-0 py-1 text-center text-[13px] font-semibold tabular-nums ${
                        tone === "closed" ? TEXT_MUTED_CLASS : "text-[#2C3E50]"
                      } ${ymd === today ? todayMark : ""}`}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {list.map((row) => (
              <tr
                key={row.key}
                className={`cursor-pointer ${focusKey === row.key ? "bg-[#E8EEF4]" : ""}`}
                onClick={() => onFocus(row.procedureCode, row.regimeKey)}
              >
                <th
                  className={`sticky left-0 z-10 w-36 max-w-36 truncate px-1 py-0.5 text-left font-medium ${
                    focusKey === row.key ? "bg-[#E8EEF4]" : "bg-white"
                  }`}
                >
                  <span className="block truncate">{row.procedureName}</span>
                  {row.paramsLabel ? (
                    <span className={`block truncate font-normal ${TEXT_MUTED_CLASS}`}>
                      {row.paramsLabel}
                    </span>
                  ) : null}
                </th>
                {days.map((ymd) => {
                  const dayMarks = stayPlanMarksForDay(row.marks, ymd);
                  const mark = pickStayPlanMarkForDay(row.marks, ymd);
                  const tone = dayTone(ymd, checkIn, checkout, today);
                  const laneLabel = (m: StayPlanMark) => {
                    if (m.done && m.paid) return `${legendPaid} · ${legendDone}`;
                    if (m.done && m.inPackage) return `${legendPackage} · ${legendDone}`;
                    if (m.done) return `${legendUnpaidExtra} · ${legendDone}`;
                    if (m.paid) return legendPaid;
                    if (!m.inPackage) return legendUnpaidExtra;
                    return legendPackage;
                  };
                  const place = mark
                    ? mark.open
                      ? openLabel
                      : [mark.time, mark.cabin].filter(Boolean).join(" · ")
                    : "";
                  const multi =
                    dayMarks.length > 1
                      ? dayMarks.map((m) => laneLabel(m)).join(" + ")
                      : mark
                        ? laneLabel(mark)
                        : "";
                  const hint = mark
                    ? [
                        multi,
                        stripLatinParamEcho(mark.paramsLabel ?? ""),
                        place,
                        ymd === checkout && !mark.open ? noonLabel : "",
                      ]
                        .filter(Boolean)
                        .join("\n")
                    : "";
                  return (
                    <td
                      key={ymd}
                      title={hint || undefined}
                      className={`px-0 py-0.5 text-center align-middle ${
                        tone === "closed"
                          ? "bg-slate-100"
                          : tone === "past"
                            ? "bg-rose-50"
                            : ""
                      } ${ymd === today ? todayMark : ""}`}
                    >
                      {mark ? (
                        <span
                          className={`mx-auto block h-2.5 w-2.5 rounded-full ${stayPlanDotClass(mark)}`}
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 ? (
        <p className={`mt-2 text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>
      ) : null}
    </>
  );

  return (
    <div className={ownScroll ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
      {ownScroll ? <div className="min-h-0 flex-1 overflow-auto">{tableBlock}</div> : tableBlock}
      {showLegend ? (
        <p className={`mt-2 flex shrink-0 flex-wrap gap-3 text-[12px] text-[#1E293B]`}>
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STAY_PLAN_MONEY_DOT_CLASS.package}`} />
            {legendPackage}
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${STAY_PLAN_MONEY_DOT_CLASS.unpaidExtra}`}
            />
            {legendUnpaidExtra}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STAY_PLAN_MONEY_DOT_CLASS.paid}`} />
            {legendPaid}
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full bg-[#1F4E79] ring-1 ring-white ${STAY_PLAN_DONE_RING_CLASS}`}
            />
            {legendDone}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function dayTone(
  ymd: string,
  checkIn: string,
  checkout: string,
  today: string,
): "closed" | "past" | "open" {
  if (ymd < checkIn || ymd > checkout || ymd === checkout || isBakuSunday(ymd)) return "closed";
  if (ymd < today) return "past";
  return "open";
}
