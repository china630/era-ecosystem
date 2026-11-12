import { ALL_PERMISSIONS, ENTITY_ACCESS_MATRIX } from "@/lib/auth/permissions";

describe("entity access matrix", () => {
  it("places every catalog key in exactly one cell", () => {
    const seen: string[] = [];
    for (const row of ENTITY_ACCESS_MATRIX) {
      for (const list of Object.values(row.cells)) {
        for (const key of list ?? []) seen.push(key);
      }
    }
    expect(seen.slice().sort()).toEqual([...ALL_PERMISSIONS].sort());
  });
});
