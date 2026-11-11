import { ALL_PERMISSIONS, ENTITY_ACCESS_MATRIX } from "@/lib/auth/permissions";

describe("bank entity access matrix", () => {
  it("places every catalog key in exactly one cell", () => {
    const seen = ENTITY_ACCESS_MATRIX.flatMap((row) => Object.values(row.cells).flat());
    expect(seen.slice().sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(new Set(seen).size).toBe(seen.length);
  });
});
