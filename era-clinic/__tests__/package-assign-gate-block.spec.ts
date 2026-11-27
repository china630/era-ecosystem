import {
  normalizeAssignGateBlock,
  packageAssignScopeOrGateText,
} from "../src/lib/package-assign-block";

const t = (key: string) => `t:${key}`;

describe("normalizeAssignGateBlock", () => {
  it("maps mutation codes to soft block reasons", () => {
    expect(normalizeAssignGateBlock("ANAMNESIS_REQUIRED")).toBe("NO_ANAMNESIS");
    expect(normalizeAssignGateBlock("COMPLAINT_REQUIRED")).toBe("NO_COMPLAINT");
    expect(normalizeAssignGateBlock("DIAGNOSIS_REQUIRED")).toBe("NO_DIAGNOSIS");
    expect(normalizeAssignGateBlock("CARE_TEAM_REQUIRED")).toBe("NO_CARE_TEAM");
  });

  it("passes through soft codes", () => {
    expect(normalizeAssignGateBlock("NO_ANAMNESIS")).toBe("NO_ANAMNESIS");
  });

  it("ignores unrelated codes", () => {
    expect(normalizeAssignGateBlock("EPISODE_SCOPE")).toBeNull();
    expect(normalizeAssignGateBlock(null)).toBeNull();
  });
});

describe("packageAssignScopeOrGateText", () => {
  it("maps EPISODE_SCOPE and Episode not found", () => {
    expect(packageAssignScopeOrGateText(t as never, "EPISODE_SCOPE")).toBe(
      "t:packageAssignEpisodeScope",
    );
    expect(packageAssignScopeOrGateText(t as never, null, "Episode not found")).toBe(
      "t:packageAssignEpisodeScope",
    );
  });

  it("maps lane gates", () => {
    expect(packageAssignScopeOrGateText(t as never, "ANAMNESIS_REQUIRED")).toBe(
      "t:packageAssignNoAnamnesis",
    );
  });

  it("returns null for unrelated codes", () => {
    expect(packageAssignScopeOrGateText(t as never, "STAY_QTY_EXCEEDED")).toBeNull();
  });
});
