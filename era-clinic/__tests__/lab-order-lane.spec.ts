import { labOrderLaneWhere, laneForServiceKind } from "@/domain/lab/lab-order-lane";

describe("lab order lanes", () => {
  it("keeps panels and unclassified orders on analyses", () => {
    expect(laneForServiceKind("lab_panel")).toBe("lab");
    expect(laneForServiceKind(null)).toBe("lab");
    expect(laneForServiceKind("package")).toBe("lab");
    const analyses = labOrderLaneWhere({ kinds: ["lab_panel"], unclassified: true });
    expect(JSON.stringify(analyses)).toContain("lab_panel");
    expect(JSON.stringify(analyses)).toContain("ECG");
  });

  it("puts USG and ECG on diagnostics and leaves panels out", () => {
    expect(laneForServiceKind("imaging")).toBe("diagnostic");
    expect(laneForServiceKind("functional")).toBe("diagnostic");
    const diagnostics = JSON.stringify(
      labOrderLaneWhere({ kinds: ["imaging", "functional", "endoscopy"] }),
    );
    expect(diagnostics).toContain("functional");
    expect(diagnostics).toContain("ECG");
    const analyses = JSON.stringify(
      labOrderLaneWhere({ kinds: ["lab_panel"], unclassified: true }),
    );
    expect(analyses).not.toContain("imaging");
    expect(analyses).not.toContain("functional");
  });
});
