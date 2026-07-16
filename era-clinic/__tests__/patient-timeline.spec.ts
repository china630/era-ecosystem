import { bakuDateKey } from "@/domain/patient/patient-timeline.service";

describe("patient timeline bakuDateKey", () => {
  it("groups UTC evening into next Asia/Baku calendar day", () => {
    // 2026-07-13 22:30 UTC = 2026-07-14 02:30 in Asia/Baku (UTC+4)
    expect(bakuDateKey("2026-07-13T22:30:00.000Z")).toBe("2026-07-14");
  });

  it("keeps same Baku day for afternoon UTC", () => {
    expect(bakuDateKey("2026-07-14T10:00:00.000Z")).toBe("2026-07-14");
  });
});
