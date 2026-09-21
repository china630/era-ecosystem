import {
  applyDayOverride,
  cycleSlotIndex,
  resolveCycleSlot,
  resolvedFromCycleSlot,
  type RosterTapeSlot,
} from "./roster-cycle.util";

describe("roster-cycle.util", () => {
  const office: RosterTapeSlot = {
    kind: "SHIFT",
    shiftTypeId: "office-id",
    defaultHours: 8,
  };
  const dayE: RosterTapeSlot = {
    kind: "SHIFT",
    shiftTypeId: "e-id",
    defaultHours: 7,
  };
  const off: RosterTapeSlot = { kind: "OFF" };

  const fiveTwo: RosterTapeSlot[] = [
    office,
    office,
    office,
    office,
    office,
    off,
    off,
  ];
  const twoTwo: RosterTapeSlot[] = [dayE, dayE, off, off];

  // Anchor Monday 2026-01-05
  const anchor = "2026-01-05";

  it("5/2: Mon–Fri WORK, Sat–Sun OFF from Monday anchor", () => {
    expect(cycleSlotIndex(anchor, "2026-01-05", 7)).toBe(0);
    expect(cycleSlotIndex(anchor, "2026-01-09", 7)).toBe(4);
    expect(cycleSlotIndex(anchor, "2026-01-10", 7)).toBe(5);
    expect(cycleSlotIndex(anchor, "2026-01-11", 7)).toBe(6);

    expect(resolveCycleSlot(fiveTwo, anchor, "2026-01-05").kind).toBe("SHIFT");
    expect(resolveCycleSlot(fiveTwo, anchor, "2026-01-10").kind).toBe("OFF");
    expect(resolveCycleSlot(fiveTwo, anchor, "2026-01-11").kind).toBe("OFF");
    expect(resolveCycleSlot(fiveTwo, anchor, "2026-01-12").kind).toBe("SHIFT");
  });

  it("2/2: alternating work/off pairs from Monday anchor", () => {
    expect(resolveCycleSlot(twoTwo, anchor, "2026-01-05").kind).toBe("SHIFT");
    expect(resolveCycleSlot(twoTwo, anchor, "2026-01-06").kind).toBe("SHIFT");
    expect(resolveCycleSlot(twoTwo, anchor, "2026-01-07").kind).toBe("OFF");
    expect(resolveCycleSlot(twoTwo, anchor, "2026-01-08").kind).toBe("OFF");
    expect(resolveCycleSlot(twoTwo, anchor, "2026-01-09").kind).toBe("SHIFT");
  });

  it("24/48: one H24 then two OFF", () => {
    const h24: RosterTapeSlot = {
      kind: "SHIFT",
      shiftTypeId: "h24-id",
      defaultHours: 24,
    };
    const tape: RosterTapeSlot[] = [h24, off, off];
    expect(resolveCycleSlot(tape, anchor, "2026-01-05").kind).toBe("SHIFT");
    expect(resolveCycleSlot(tape, anchor, "2026-01-06").kind).toBe("OFF");
    expect(resolveCycleSlot(tape, anchor, "2026-01-07").kind).toBe("OFF");
    expect(resolveCycleSlot(tape, anchor, "2026-01-08").kind).toBe("SHIFT");
  });

  it("negative offset wraps (date before anchor)", () => {
    // 2026-01-04 is day -1 → slot 6 for length 7
    expect(cycleSlotIndex(anchor, "2026-01-04", 7)).toBe(6);
    expect(resolveCycleSlot(fiveTwo, anchor, "2026-01-04").kind).toBe("OFF");
  });

  it("DAY_OFF override beats cycle WORK", () => {
    const base = resolvedFromCycleSlot(
      resolveCycleSlot(fiveTwo, anchor, "2026-01-05"),
      "place-1",
      "asg-1",
    );
    expect(base.type).toBe("WORK");
    const ov = applyDayOverride(base, { kind: "DAY_OFF" });
    expect(ov.type).toBe("OFF");
    expect(ov.hours).toBe(0);
    expect(ov.fromOverride).toBe(true);
  });

  it("EXTRA override forces WORK on OFF day", () => {
    const base = resolvedFromCycleSlot(
      resolveCycleSlot(fiveTwo, anchor, "2026-01-10"),
      "place-1",
      "asg-1",
    );
    expect(base.type).toBe("OFF");
    const ov = applyDayOverride(base, {
      kind: "EXTRA",
      shiftTypeId: "e-id",
      defaultHours: 7,
      placeId: "place-2",
    });
    expect(ov.type).toBe("WORK");
    expect(ov.hours).toBe(7);
    expect(ov.placeId).toBe("place-2");
  });
});
