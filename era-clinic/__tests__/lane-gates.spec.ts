import { NAFTA_LANE_GATE, laneDenied, normalizeLaneGate } from "@/domain/sanatorium/lane-gates";

describe("lane gates", () => {
  it("Nafta default blocks procedures until anamnesis, complaint, and diagnosis", () => {
    const empty = { anamnesisText: "", complaintCount: 0, diagnosisCount: 0 };
    expect(laneDenied(NAFTA_LANE_GATE, "procedures", empty)?.code).toBe("ANAMNESIS_REQUIRED");
    expect(
      laneDenied(NAFTA_LANE_GATE, "procedures", {
        anamnesisText: "htn",
        complaintCount: 0,
        diagnosisCount: 0,
      })?.code,
    ).toBe("COMPLAINT_REQUIRED");
    expect(
      laneDenied(NAFTA_LANE_GATE, "procedures", {
        anamnesisText: "htn",
        complaintCount: 1,
        diagnosisCount: 0,
      })?.code,
    ).toBe("DIAGNOSIS_REQUIRED");
    expect(
      laneDenied(NAFTA_LANE_GATE, "procedures", {
        anamnesisText: "htn",
        complaintCount: 1,
        diagnosisCount: 1,
      }),
    ).toBeNull();
  });

  it("labs stay open with an empty intake", () => {
    expect(
      laneDenied(NAFTA_LANE_GATE, "labs", {
        anamnesisText: null,
        complaintCount: 0,
        diagnosisCount: 0,
      }),
    ).toBeNull();
  });

  it("blank JSON keeps the Nafta default", () => {
    expect(normalizeLaneGate(null)).toEqual(NAFTA_LANE_GATE);
    expect(normalizeLaneGate("{")).toEqual(NAFTA_LANE_GATE);
  });
});
