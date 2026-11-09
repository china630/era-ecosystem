"use client";

import { DATA_TABLE_TD_CLASS, DATA_TABLE_TR_CLASS } from "../lib/design-system";

/** One muted row inside an already-rendered table. Keeps the header when the list is empty. */
export function FinanceEmptyTableRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr className={DATA_TABLE_TR_CLASS}>
      <td
        colSpan={colSpan}
        className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
      >
        {message}
      </td>
    </tr>
  );
}
