"use client";

import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "./design-system";
import type { EraDataGridProps } from "./era-ops-types";

/**
 * Stub master-data grid — modal CRUD hooks; satellites extend with column editors.
 */
export function EraDataGrid<T extends Record<string, unknown>>({
  title,
  columns,
  rows,
  rowKey,
  onAdd,
  addLabel = "Add",
  emptyMessage = "No rows yet.",
  toolbar,
}: EraDataGridProps<T>) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <h2 className="text-[15px] font-semibold text-[#34495E]">{title}</h2> : null}
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {onAdd ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAdd}>
              {addLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              {columns.map((col) => (
                <th key={col.key} className={`${DATA_TABLE_TH_LEFT_CLASS} ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td
                  className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                  colSpan={columns.length}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className={DATA_TABLE_TR_CLASS}>
                  {columns.map((col) => (
                    <td key={col.key} className={`${DATA_TABLE_TD_CLASS} ${col.className ?? ""}`}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
