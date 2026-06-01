"use client";

import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";

export function SuperAdminDataTable({
  columns,
  rows,
  loading,
}: {
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
  loading?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-[#7F8C8D]">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-[#7F8C8D]">No rows</p>;
  }
  const keys = Object.keys(rows[0] ?? {});
  return (
    <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            {columns.map((c) => (
              <th key={c} className="p-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#D5DADF]/60">
              {keys.map((k) => (
                <td key={k} className="p-3 text-[#34495E]">
                  {String(row[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
