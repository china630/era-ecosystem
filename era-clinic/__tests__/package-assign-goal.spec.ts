import { packageAssignGoalLayers } from "../src/domain/planning/package-assign-goal";

describe("packageAssignGoalLayers (anti-inflation)", () => {
  it("N > F → draft is only the hole N−F", () => {
    expect(packageAssignGoalLayers({ target: 5, fact: 2, kept: 0 })).toEqual({
      goal: 5,
      draft: 3,
      cut: 0,
    });
  });

  it("partial miss then re-Saxla does not re-request seated fact", () => {
    // Seated 2 of goal 5 → hole 3. Second Saxla must request 3, not 5.
    const afterMiss = packageAssignGoalLayers({ target: 5, fact: 2, kept: 0 });
    expect(afterMiss.draft).toBe(3);
    expect(afterMiss.draft + afterMiss.cut).toBe(3);
  });

  it("N < F → cut only, no draft", () => {
    expect(packageAssignGoalLayers({ target: 8, fact: 10, kept: 2 })).toEqual({
      goal: 8,
      draft: 0,
      cut: 2,
    });
  });

  it("cannot cut below kept (done / immovable)", () => {
    expect(packageAssignGoalLayers({ target: 1, fact: 5, kept: 3 })).toEqual({
      goal: 3,
      draft: 0,
      cut: 2,
    });
  });

  it("N = F → idle", () => {
    expect(packageAssignGoalLayers({ target: 4, fact: 4, kept: 1 })).toEqual({
      goal: 4,
      draft: 0,
      cut: 0,
    });
  });

  it("UI rem cap: draft hole never exceeds available package rem", () => {
    // Fact 2, want 8, rem only 3 → layers still report draft 6; caller caps target to 5 first.
    const capped = packageAssignGoalLayers({ target: 5, fact: 2, kept: 0 });
    expect(capped.draft).toBe(3);
    expect(capped.cut).toBe(0);
  });
});
