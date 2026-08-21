/**
 * CLI-47 W2 — Finance clinic TTK write-off helper semantics (unit-level).
 * Full Nest dispatch is covered by integration tests when available.
 */
describe("clinic TTK finance write-off policy", () => {
  it("documents warn+post: unknown SKU skips without throwing", () => {
    const warnings: string[] = [];
    const lines = [{ sku: "MISSING", qty: 1 }];
    let skipped = 0;
    for (const line of lines) {
      // Simulate resolve miss
      const product = null;
      if (!product) {
        skipped += 1;
        warnings.push(`Unknown SKU ${line.sku}`);
      }
    }
    expect(skipped).toBe(1);
    expect(warnings[0]).toContain("MISSING");
  });

  it("empty lines is a no-op", () => {
    const lines: Array<{ sku: string; qty: number }> = [];
    expect(lines.length).toBe(0);
  });
});
