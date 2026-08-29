import { normalizeDateOnly } from "./workforce-date";

describe("workforce date normalization", () => {
  it("normalizes Excel serial, dotted DMY, slash MDY, and empty sentinels", () => {
    expect(normalizeDateOnly(28019)).toBe("1976-09-16");
    expect(normalizeDateOnly(46154)).toBe("2026-05-12");
    expect(normalizeDateOnly("07.06.2024")).toBe("2024-06-07");
    expect(normalizeDateOnly("9/16/76")).toBe("1976-09-16");
    expect(normalizeDateOnly("1991-06-24")).toBe("1991-06-24");
    expect(normalizeDateOnly("NAN")).toBe("");
    expect(normalizeDateOnly(0)).toBe("");
    expect(normalizeDateOnly("")).toBe("");
  });

  it("keeps UTC-midnight Date objects on the same calendar day", () => {
    expect(normalizeDateOnly(new Date("2026-05-12T00:00:00.000Z"))).toBe("2026-05-12");
  });
});
