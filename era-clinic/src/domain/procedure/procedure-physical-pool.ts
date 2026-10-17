/** Map procedure-type LOCATION/EQUIPMENT rows to a cabinet pool for SatAdmin + planner. */

export type PhysicalRequirementLike = {
  role: string;
  resourceKind?: "ROOM" | "EQUIPMENT" | null;
  resourceCode?: string | null;
  quantity?: number;
  staffMode?: "HARD" | "SOFT";
  required?: boolean;
  id?: string;
};

export function physicalResourceCodesFromRequirements(
  rows: PhysicalRequirementLike[],
): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.role !== "LOCATION" && r.role !== "EQUIPMENT") continue;
    const code = r.resourceCode?.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

export function displayPhysicalResourceCodes(rows: PhysicalRequirementLike[]): string {
  const codes = physicalResourceCodesFromRequirements(rows);
  return codes.length > 0 ? codes.join(", ") : "—";
}

/** One STAFF row (SOFT if any), drop LOCATION/EQUIPMENT without a resource code. */
export function normalizeProcedureRequirements<T extends PhysicalRequirementLike>(rows: T[]): T[] {
  const physical = rows.filter(
    (row) =>
      (row.role === "LOCATION" || row.role === "EQUIPMENT") && Boolean(row.resourceCode?.trim()),
  );
  const staffRows = rows.filter((row) => row.role === "STAFF");
  const preferred = staffRows.find((row) => row.staffMode === "SOFT") ?? staffRows[0];
  const staff = preferred
    ? [preferred]
    : ([
        {
          role: "STAFF",
          staffMode: "SOFT",
          quantity: 1,
          required: true,
        } as T,
      ]);
  return [...physical, ...staff];
}

export function applyPhysicalResourcePool<T extends PhysicalRequirementLike>(
  rows: T[],
  codes: string[],
  kindOf: (code: string) => "ROOM" | "EQUIPMENT" | undefined,
): T[] {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const physical: T[] = unique.map((code) => {
    const kind = kindOf(code) ?? "ROOM";
    return {
      role: kind === "ROOM" ? "LOCATION" : "EQUIPMENT",
      resourceKind: kind,
      resourceCode: code,
      quantity: 1,
      staffMode: "HARD",
      required: true,
    } as T;
  });
  return normalizeProcedureRequirements([...physical, ...rows.filter((row) => row.role === "STAFF")]);
}
