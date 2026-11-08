"use client";

import { TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";
import type { StayPlan, StayPlanMark } from "@/domain/sanatorium/package-assign.service";

type Row = {
  key: string;
  procedureCode: string;
  regimeKey: string;
  procedureName: string;
  paramsLabel: string;
  marks: StayPlanMark[];
};

export function StayDayGrid({
  plan,
  focusKey,
  onFocus,
  emptyLabel,
  openLabel,
  noonLabel,
}: {
  plan: StayPlan;
  focusKey: string | null;
  onFocus: (procedureCode: string, regimeKey: string) => void;
  emptyLabel: string;
  openLabel: string;
  noonLabel: string;
}) {
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
  if (plan.days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const closed = new Set(plan.closedDays);
  return (
    <div className="h-full min-h-0 overflow-auto">
      <table className="border-separate border-spacing-0 text-[11px]">
        <thead className="sticky top-0 z-10 bg-white">
          <tr>
            <th className="sticky left-0 z-20 min-w-[9rem] bg-white px-1 py-1 text-left font-medium" />
            {plan.days.map((ymd) => {
              const [, month, day] = ymd.split("-");
              const muted = closed.has(ymd) || ymd === plan.checkoutYmd;
              return (
                <th
                  key={ymd}
                  className={`w-8 px-0 py-1 text-center font-medium tabular-nums ${muted ? TEXT_MUTED_CLASS : ""}`}
                >
                  {day}.{month}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.key} className={focusKey === row.key ? "bg-[#E8EEF4]" : ""}>
              <th className="sticky left-0 z-10 max-w-[11rem] truncate bg-white px-1 py-0.5 text-left font-medium">
                <span className="block truncate">{row.procedureName}</span>
                {row.paramsLabel ? (
                  <span className={`block truncate font-normal ${TEXT_MUTED_CLASS}`}>{row.paramsLabel}</span>
                ) : null}
              </th>
              {plan.days.map((ymd) => {
                const mark = row.marks.find((item) => item.ymd === ymd);
                const muted = closed.has(ymd) || ymd === plan.checkoutYmd;
                const place = mark
                  ? mark.open
                    ? openLabel
                    : [mark.time, mark.cabin].filter(Boolean).join(" · ")
                  : "";
                const hint = mark
                  ? [
                      mark.paramsLabel,
                      place,
                      ymd === plan.checkoutYmd && !mark.open ? noonLabel : "",
                    ]
                      .filter(Boolean)
                      .join("\n")
                  : "";
                return (
                  <td key={ymd} className={`px-0 py-0.5 text-center ${muted ? "bg-slate-50" : ""}`}>
                    {mark ? (
                      <button
                        type="button"
                        title={hint}
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          mark.done
                            ? "bg-slate-700"
                            : mark.paid
                              ? "bg-amber-400"
                              : "bg-[#1F4E79]"
                        }`}
                        onClick={() => onFocus(row.procedureCode, row.regimeKey)}
                      />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 ? <p className={`mt-2 text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p> : null}
    </div>
  );
}
