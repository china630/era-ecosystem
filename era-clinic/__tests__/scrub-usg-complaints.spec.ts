import { isUsgProtocolComplaint } from "../scripts/nafta-cutover/scrub-usg-complaints";

describe("scrub-usg-complaints heuristics", () => {
  it("flags long USG protocol text", () => {
    const text =
      "USG qarin boşluğu: qaraciyər düzgün formada, ölçüsü 120 mm. Böyrək parankiması norma daxil.";
    expect(isUsgProtocolComplaint(text)).toBe(true);
  });

  it("ignores short generic complaint", () => {
    expect(isUsgProtocolComplaint("Baş ağrısı")).toBe(false);
  });
});
