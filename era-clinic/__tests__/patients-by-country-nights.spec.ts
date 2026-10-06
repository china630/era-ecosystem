import { nightsInsideMonth } from "@/domain/reports/patients-by-country.service";
import { parseBakuDateTime } from "@era/satellite-kit/time";

describe("nightsInsideMonth", () => {
  it("keeps September nights in September and October nights in October", () => {
    const opened = parseBakuDateTime("2026-09-28", "14:00");
    const closed = parseBakuDateTime("2026-10-03", "11:00");
    expect(nightsInsideMonth(opened, closed, "2026-09")).toBe(3);
    expect(nightsInsideMonth(opened, closed, "2026-10")).toBe(2);
  });
});
