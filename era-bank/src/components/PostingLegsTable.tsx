"use client";

import { formatAznMinor } from "./ops-ui";

type Leg = {
  accountId?: string | null;
  glAccountId?: string;
  branchId?: string;
  debitMinor?: unknown;
  creditMinor?: unknown;
  currency?: string;
};

export function PostingLegsTable({ legs }: { legs: Leg[] }) {
  if (!legs?.length) {
    return <p className="text-sm text-muted-foreground">No legs</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2">Account</th>
            <th className="px-3 py-2">GL</th>
            <th className="px-3 py-2">Debit</th>
            <th className="px-3 py-2">Credit</th>
            <th className="px-3 py-2">Ccy</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => (
            <tr key={i} className="border-b">
              <td className="px-3 py-2 font-mono text-[11px]">{leg.accountId ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-[11px]">{leg.glAccountId ?? "—"}</td>
              <td className="px-3 py-2">{formatAznMinor(leg.debitMinor)}</td>
              <td className="px-3 py-2">{formatAznMinor(leg.creditMinor)}</td>
              <td className="px-3 py-2">{leg.currency ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
