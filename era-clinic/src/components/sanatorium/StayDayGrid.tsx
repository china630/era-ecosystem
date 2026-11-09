"use client";

import { useLocale } from "next-intl";
import { TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";
import type { StayPlan, StayPlanMark } from "@/domain/sanatorium/package-assign.service";

/** Max stay plus one day before check-in and one after checkout. */
const DAY_SLOTS = 23;

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

function monthTitle(ymd: string, locale: string): string {
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "Asia/Baku",
  }).format(bakuNoon(ymd));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function windowDays(plan: StayPlan): string[] {
  if (plan.days.length === 0) return [];
  const checkIn = plan.days[0]!;
  const checkout = plan.checkoutYmd ?? plan.days[plan.days.length - 1]!;
  const days: string[] = [];
  for (
    let ymd = addBakuDays(checkIn, -1);
    ymd <= addBakuDays(checkout, 1) && days.length < 62;
    ymd = addBakuDays(ymd, 1)
  ) {
    days.push(ymd);
  }
  return days;
}

export function StayDayGrid({
  plan,
  focusKey,
  onFocus,
  emptyLabel,
  openLabel,
  noonLabel,
  legendPackage,
  legendPaid,
  legendDone,
}: {
  plan: StayPlan;
  focusKey: string | null;
  onFocus: (procedureCode: string, regimeKey: string) => void;
  emptyLabel: string;
  openLabel: string;
  noonLabel: string;
  legendPackage: string;
  legendPaid: string;
  legendDone: string;
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
      paramsLabel: mark.paramsLabel,
      marks: [],
    };
    row.marks.push(mark);
    rows.set(key, row);
  }
  const list = [...rows.values()];
  const days = windowDays(plan);
  if (days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const checkIn = plan.days[0]!;
  const checkout = plan.checkoutYmd ?? plan.days[plan.days.length - 1]!;
  const today = todayBakuYmd();
  const monthSpans: Array<{ ymd: string; span: number }> = [];
  for (const ymd of days) {
    const prev = monthSpans[monthSpans.length - 1];
    if (prev && prev.ymd.slice(0, 7) === ymd.slice(0, 7)) prev.span += 1;
    else monthSpans.push({ ymd, span: 1 });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="table-fixed border-separate border-spacing-0 text-[12px]"
          style={{ width: `calc(9rem + (100% - 9rem) * ${days.length} / ${DAY_SLOTS})` }}
        >
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 w-36 bg-white" />
              {monthSpans.map((group) => (
                <th
                  key={group.ymd.slice(0, 7)}
                  colSpan={group.span}
                  className="px-1 py-1 text-left text-[12px] font-semibold capitalize text-[#2C3E50]"
                >
                  {monthTitle(group.ymd, locale)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 w-36 bg-white" />
              {days.map((ymd) => {
                const day = ymd.slice(8);
                const gray = isGrayDay(ymd, checkIn, checkout, today);
                return (
                  <th
                    key={ymd}
                    className={`px-0 py-1 text-center text-[13px] font-semibold tabular-nums ${
                      gray ? TEXT_MUTED_CLASS : "text-[#2C3E50]"
                    } ${ymd === today ? "shadow-[inset_2px_0_0_0_#1F4E79]" : ""}`}
                  >
                    {day}
                  </th>
                );
              })}
            </tr>
          </thead>
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
                  const mark = row.marks.find((item) => item.ymd === ymd);
                  const gray = isGrayDay(ymd, checkIn, checkout, today);
                  const place = mark
                    ? mark.open
                      ? openLabel
                      : [mark.time, mark.cabin].filter(Boolean).join(" · ")
                    : "";
                  const hint = mark
                    ? [mark.paramsLabel, place, ymd === checkout && !mark.open ? noonLabel : ""]
                        .filter(Boolean)
                        .join("\n")
                    : "";
                  return (
                    <td
                      key={ymd}
                      title={hint || undefined}
                      className={`px-0 py-0.5 text-center ${gray ? "bg-slate-100" : ""} ${
                        ymd === today ? "shadow-[inset_2px_0_0_0_#1F4E79]" : ""
                      }`}
                    >
                      {mark ? (
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            mark.done ? "bg-slate-700" : mark.paid ? "bg-amber-400" : "bg-[#1F4E79]"
                          }`}
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 ? (
          <p className={`mt-2 text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>
        ) : null}
      </div>
      <p className={`mt-2 flex shrink-0 flex-wrap gap-3 text-[12px] ${TEXT_MUTED_CLASS}`}>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1F4E79]" />
          {legendPackage}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          {legendPaid}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-700" />
          {legendDone}
        </span>
      </p>
    </div>
  );
}

function isGrayDay(ymd: string, checkIn: string, checkout: string, today: string): boolean {
  if (ymd < checkIn || ymd > checkout) return true;
  if (ymd === checkout) return true;
  if (isBakuSunday(ymd)) return true;
  if (ymd < today) return true;
  return false;
}
