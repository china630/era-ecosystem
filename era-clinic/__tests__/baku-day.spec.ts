/**
 * @jest-environment node
 */
describe("parseBakuDateTime", () => {
  const prevTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  });

  it("anchors wall 18:36 Baku to 14:36Z regardless of process TZ", async () => {
    const { parseBakuDateTime, bakuTimeLabel } = await import("@/lib/baku-day");
    const { bakuDateKey } = await import("@/domain/patient/patient-timeline.service");
    const d = parseBakuDateTime("2026-08-28", "18:36:00");
    expect(d.toISOString()).toBe("2026-08-28T14:36:00.000Z");
    expect(bakuTimeLabel(d)).toBe("18:36");
    expect(bakuDateKey(d)).toBe("2026-08-28");
    expect(parseBakuDateTime("2026-08-28", "18:36").toISOString()).toBe("2026-08-28T14:36:00.000Z");
  });
});
