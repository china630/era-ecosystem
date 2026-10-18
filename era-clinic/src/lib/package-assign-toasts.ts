import { showApiError, showSuccess } from "@era/satellite-kit/ui";

export type AssignToastLine = {
  procedureCode: string;
  procedureName: string;
  qty: number;
};

export type AssignToastMiss = {
  procedureCode?: string;
  procedureName?: string;
};

export function toastPackageAssignOutcome(
  requested: AssignToastLine[],
  misses: AssignToastMiss[] | undefined,
  t: (key: string, values: { count: number; name: string }) => string,
): void {
  const missQty = new Map<string, { name: string; qty: number }>();
  for (const miss of misses ?? []) {
    const code = miss.procedureCode || miss.procedureName || "";
    if (!code) continue;
    const name = miss.procedureName || miss.procedureCode || code;
    const row = missQty.get(code) ?? { name, qty: 0 };
    row.qty += 1;
    missQty.set(code, row);
  }

  const seen = new Set<string>();
  for (const line of requested) {
    if (line.qty < 1 || seen.has(line.procedureCode)) continue;
    seen.add(line.procedureCode);
    const asked = requested
      .filter((row) => row.procedureCode === line.procedureCode)
      .reduce((sum, row) => sum + row.qty, 0);
    const failed = missQty.get(line.procedureCode)?.qty ?? 0;
    const placed = Math.max(0, asked - failed);
    const name = line.procedureName || line.procedureCode;
    if (placed > 0) {
      showSuccess(t("packageAssignPlaced", { count: placed, name }));
    }
    if (failed > 0) {
      showApiError({
        error: t("packageAssignNotPlaced", { count: failed, name }),
      });
    }
  }

  for (const [code, row] of missQty) {
    if (seen.has(code)) continue;
    showApiError({
      error: t("packageAssignNotPlaced", { count: row.qty, name: row.name }),
    });
  }
}
