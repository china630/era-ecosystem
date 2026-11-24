"use client";

import { TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";
import {
  procedureLoadLevelColor,
  type ProcedureLoadMatrix,
} from "@/domain/planning/procedure-load-matrix";

export function ProcedureLoadMatrixView({
  matrix,
  excludeCodes,
  emptyLabel,
  legendLow,
  legendHigh,
  onRowClick,
}: {
  matrix: ProcedureLoadMatrix | null;
  /** Hide rows already on the patient plan. */
  excludeCodes?: ReadonlySet<string>;
  emptyLabel: string;
  legendLow: string;
  legendHigh: string;
  onRowClick?: (procedureCode: string) => void;
}) {
  if (!matrix || matrix.rows.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const rows = excludeCodes?.size
    ? matrix.rows.filter((row) => !excludeCodes.has(row.procedureCode))
    : matrix.rows;
  if (rows.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] tabular-nums">
        <span className={TEXT_MUTED_CLASS}>{legendLow}</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1" style={{ background: procedureLoadLevelColor(i) }} />
          ))}
        </div>
        <span className={TEXT_MUTED_CLASS}>{legendHigh}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-1 py-1 text-left font-medium"> </th>
              {matrix.days.map((ymd) => (
                <th key={ymd} className="px-0.5 py-1 text-center font-normal tabular-nums">
                  {ymd.slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.procedureCode}>
                <td className="sticky left-0 z-10 max-w-[9rem] truncate bg-white px-1 py-0.5 font-medium">
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
                {row.cells.map((cell) => (
                  <td
                    key={cell.ymd}
                    title={`${cell.count}`}
                    className="h-7 min-w-[1.5rem] border border-white/60 text-center tabular-nums"
                    style={{ background: procedureLoadLevelColor(cell.level) }}
                  >
                    {cell.count > 0 ? cell.count : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
