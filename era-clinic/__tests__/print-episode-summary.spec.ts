import { printLabel } from "@/domain/print/print-labels";
import { PRINT_PROCEDURE_STATUSES } from "@/domain/print/print-procedures.service";

describe("course summary print", () => {
  it("has trilingual title and interim copy", () => {
    expect(printLabel("en", "episodeSummary")).toBe("Course summary");
    expect(printLabel("ru", "episodeSummary")).toBe("Итог курса");
    expect(printLabel("az", "episodeSummary")).toBe("Kursun yekunu");
    expect(printLabel("en", "episodeSummaryInterim")).toMatch(/interim/i);
  });

  it("reuses seated procedure statuses from the schedule sheet", () => {
    expect(PRINT_PROCEDURE_STATUSES).toEqual([
      "SCHEDULED",
      "CHECKED_IN",
      "COMPLETED",
      "NO_SHOW",
    ]);
  });
});
