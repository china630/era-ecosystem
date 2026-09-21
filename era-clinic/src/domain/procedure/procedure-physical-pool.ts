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

export function applyPhysicalResourcePool<T extends PhysicalRequirementLike>(
  rows: T[],
  codes: string[],
  kindOf: (code: string) => "ROOM" | "EQUIPMENT" | undefined,
): T[] {
  const staff = rows.filter((r) => r.role === "STAFF");
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const physical: T[] = [];
  if (unique.length === 0) {
    physical.push({
      role: "EQUIPMENT",
      resourceKind: "EQUIPMENT",
      resourceCode: null,
      quantity: 1,
      staffMode: "HARD",
      required: true,
    } as T);
  } else {
    for (const code of unique) {
      const kind = kindOf(code) ?? "ROOM";
      physical.push({
        role: kind === "ROOM" ? "LOCATION" : "EQUIPMENT",
        resourceKind: kind,
        resourceCode: code,
        quantity: 1,
        staffMode: "HARD",
        required: true,
      } as T);
    }
  }
  const staffOut =
    staff.length > 0
      ? staff
      : ([
          {
            role: "STAFF",
            staffMode: "SOFT",
            quantity: 1,
            required: true,
          },
        ] as T[]);
  return [...physical, ...staffOut];
}
