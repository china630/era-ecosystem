import { labOrderLaneWhere, laneForServiceKind } from "@/domain/lab/lab-order-lane";

describe("lab order lanes", () => {
  it("keeps panels and unclassified orders on analyses", () => {
    expect(laneForServiceKind("lab_panel")).toBe("lab");
    expect(laneForServiceKind(null)).toBe("lab");
    expect(laneForServiceKind("package")).toBe("lab");
    expect(labOrderLaneWhere({ kinds: ["lab_panel"], unclassified: true })).toEqual({
      OR: [
        {
          items: {
            some: {
              diagnosticService: { modality: { kind: { in: ["lab_panel"] } } },
            },
          },
        },
        { items: { none: { diagnosticServiceId: { not: null } } } },
      ],
    });
  });

  it("puts USG and ECG on diagnostics and leaves panels out", () => {
    expect(laneForServiceKind("imaging")).toBe("diagnostic");
    expect(laneForServiceKind("functional")).toBe("diagnostic");
    expect(labOrderLaneWhere({ kinds: ["imaging", "functional", "endoscopy"] })).toEqual({
      items: {
        some: {
          diagnosticService: {
            modality: { kind: { in: ["imaging", "functional", "endoscopy"] } },
          },
        },
      },
    });
    const analyses = JSON.stringify(
      labOrderLaneWhere({ kinds: ["lab_panel"], unclassified: true }),
    );
    expect(analyses).not.toContain("imaging");
    expect(analyses).not.toContain("functional");
  });
});
