/**
 * @jest-environment node
 */
import { parseBakuDateTime } from "@/lib/baku-day";
import { matrixNowLineLeft } from "@/components/sanatorium/matrix-now-line";

function slot(hour: number, minute: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return parseBakuDateTime("2026-10-01", `${hh}:${mm}:00`).toISOString();
}

describe("matrixNowLineLeft", () => {
  const prevTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  });

  it("places 11:26 Baku on the 11:30 column, not later in a wide card", () => {
    const slotTimes: string[] = [];
    for (let h = 8; h <= 16; h += 1) {
      slotTimes.push(slot(h, 0));
      if (h < 17) slotTimes.push(slot(h, 30));
    }
    const now = parseBakuDateTime("2026-10-01", "11:26:00");
    const left = matrixNowLineLeft({
      slotTimes,
      now,
      slotColumnWidth: "3.5rem",
    });
    const cols = (11 * 60 + 26 - 8 * 60) / 30;
    const placed = Number(left?.match(/calc\(10rem \+ ([0-9.]+) \* 3\.5rem\)/)?.[1]);
    expect(placed).toBeCloseTo(cols, 8);
  });

  it("keeps 14:15 on the post-lunch column when 13:00 is omitted", () => {
    const slotTimes = [
      slot(12, 0),
      slot(12, 30),
      slot(14, 0),
      slot(14, 30),
    ];
    const now = parseBakuDateTime("2026-10-01", "14:15:00");
    const left = matrixNowLineLeft({
      slotTimes,
      now,
      slotColumnWidth: "1.75rem",
    });
    expect(left).toBe(`calc(10rem + ${2.5} * 1.75rem)`);
  });
});
