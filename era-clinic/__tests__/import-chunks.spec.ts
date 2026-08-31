import { mergeImportSummaries } from "@/lib/import/upload";
import { listImportEntities } from "@/lib/import/adapters";

describe("clinic import chunks", () => {
  it("slots adapter allows multiple files", () => {
    const slots = listImportEntities().find((e) => e.entity === "slots");
    expect(slots?.allowMultiple).toBe(true);
  });

  it("merges per-chunk summaries", () => {
    const merged = mergeImportSummaries([
      {
        entity: "slots",
        label: "Slots",
        dryRun: true,
        totalRows: 5000,
        created: 10,
        updated: 20,
        skipped: 1,
        errors: [{ row: 2, message: "a" }],
      },
      {
        entity: "slots",
        label: "Slots",
        dryRun: true,
        totalRows: 480,
        created: 5,
        updated: 3,
        skipped: 0,
        errors: [{ row: 3, message: "b" }],
      },
    ]);
    expect(merged.totalRows).toBe(5480);
    expect(merged.created).toBe(15);
    expect(merged.updated).toBe(23);
    expect(merged.skipped).toBe(1);
    expect(merged.errors).toHaveLength(2);
  });
});
