"use client";

import { useLocale } from "next-intl";
import { TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";
import {
  procedureLoadLevelColor,
  type ProcedureLoadMatrix,
} from "@/domain/planning/procedure-load-matrix";
import {
  STAY_DAY_SLOTS,
  stayMonthSpans,
  stayMonthTitle,
} from "@/domain/sanatorium/stay-day-axis";

export function ProcedureLoadMatrixView({
  matrix,
  excludeCodes,
  emptyLabel,
  legendLow,
  legendHigh,
  onRowClick,
  /** When set, render only these days (align with patient stay grid). */
  dayColumns,
  /** Match stay grid width formula when aligned under StayDayGrid. */
  matchStayWidth = false,
  /** False when parent owns scroll with the stay grid. */
  ownScroll = true,
}: {
  matrix: ProcedureLoadMatrix | null;
  /** Hide rows already on the patient plan. */
  excludeCodes?: ReadonlySet<string>;
  emptyLabel: string;
  legendLow: string;
  legendHigh: string;
  onRowClick?: (procedureCode: string) => void;
  dayColumns?: string[];
  matchStayWidth?: boolean;
  ownScroll?: boolean;
}) {
  const locale = useLocale();
  if (!matrix || matrix.rows.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const rows = excludeCodes?.size
    ? matrix.rows.filter((row) => !excludeCodes.has(row.procedureCode))
    : matrix.rows;
  if (rows.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const days = dayColumns?.length ? dayColumns : matrix.days;
  const monthSpans = stayMonthSpans(days);
  const cellFor = (row: (typeof rows)[0], ymd: string) =>
    row.cells.find((c) => c.ymd === ymd) ?? {
      ymd,
      count: 0,
      capacity: row.dayCapacity,
      pct: null,
      level: 0,
    };

  const table = (
    <table className="w-full table-fixed border-collapse text-[12px]">
      <thead>
        <tr>
          <th className="sticky left-0 z-10 w-36 bg-white px-1 py-1 text-left font-medium"> </th>
          {monthSpans.map((group) => (
            <th
              key={group.ymd.slice(0, 7)}
              colSpan={group.span}
              className="px-0.5 py-0.5 text-center text-[12px] font-semibold text-[#2C3E50]"
            >
              {stayMonthTitle(group.ymd, locale)}
            </th>
          ))}
        </tr>
        <tr>
          <th className="sticky left-0 z-10 w-36 bg-white px-1 py-1 text-left font-medium"> </th>
          {days.map((ymd) => (
            <th key={ymd} className="px-0.5 py-1 text-center font-normal tabular-nums">
              {ymd.slice(8)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.procedureCode}>
            <td className="sticky left-0 z-10 w-36 max-w-36 truncate bg-white px-1 py-0.5 font-medium">
              {onRowClick ? (
                <button
                  type="button"
                  className="truncate text-left hover:underline"
                  onClick={() => onRowClick(row.procedureCode)}
                >
                  {row.procedureName}
                </button>
              ) : (
                row.procedureName
              )}
            </td>
            {days.map((ymd) => {
              const cell = cellFor(row, ymd);
              const title =
                cell.capacity != null && cell.capacity > 0
                  ? `${cell.count}/${cell.capacity}${
                      cell.pct != null ? ` (${Math.round(cell.pct * 100)}%)` : ""
                    }`
                  : `${cell.count}`;
              const label =
                cell.count > 0
                  ? cell.capacity != null && cell.capacity > 0
                    ? `${cell.count}/${cell.capacity}`
                    : String(cell.count)
                  : "";
              return (
                <td
                  key={ymd}
                  title={title}
                  className="h-7 border border-white/60 text-center text-[10px] tabular-nums"
                  style={{ background: procedureLoadLevelColor(cell.level) }}
                >
                  {label}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const sized =
    matchStayWidth && days.length > 0 ? (
      <div style={{ width: `calc(9rem + (100% - 9rem) * ${days.length} / ${STAY_DAY_SLOTS})` }}>
        {table}
      </div>
    ) : (
      table
    );

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div className="flex items-center gap-2 text-[11px] tabular-nums">
        <span className={TEXT_MUTED_CLASS}>{legendLow}</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1" style={{ background: procedureLoadLevelColor(i) }} />
          ))}
        </div>
        <span className={TEXT_MUTED_CLASS}>{legendHigh}</span>
      </div>
      {ownScroll ? <div className="min-h-0 flex-1 overflow-auto">{sized}</div> : sized}
    </div>
  );
}

export function loadLevelForCodeDay(
  matrix: ProcedureLoadMatrix | null | undefined,
  procedureCode: string,
  ymd: string,
): number | null {
  if (!matrix) return null;
  const row = matrix.rows.find((r) => r.procedureCode === procedureCode);
  if (!row) return null;
  const cell = row.cells.find((c) => c.ymd === ymd);
  return cell ? cell.level : null;
}
