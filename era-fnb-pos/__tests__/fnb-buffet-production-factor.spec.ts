import { portionsFromCovers, emptySlotWarnCount } from "@/lib/buffet-production-factor";

describe("buffet production factor", () => {
  it("rounds covers × factor% with min 1 when covers>0 path uses max(1,round)", () => {
    expect(portionsFromCovers(100, 0, 80)).toBe(80);
    expect(portionsFromCovers(50, 10, 100)).toBe(60);
    expect(portionsFromCovers(1, 0, 80)).toBe(1);
  });

  it("treats zero covers as still min 1 portion (kitchen floor)", () => {
    expect(portionsFromCovers(0, 0, 80)).toBe(1);
  });

  it("counts empty slots", () => {
    expect(emptySlotWarnCount([{ lines: [] }, { lines: [{ id: "1" }] }, {}])).toBe(2);
  });
});
