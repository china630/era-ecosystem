import {
  applyPhysicalResourcePool,
  displayPhysicalResourceCodes,
  physicalResourceCodesFromRequirements,
} from "@/domain/procedure/procedure-physical-pool";

describe("procedure physical resource pool", () => {
  it("collects unique LOCATION/EQUIPMENT codes in order", () => {
    expect(
      physicalResourceCodesFromRequirements([
        { role: "LOCATION", resourceCode: "CAB-A" },
        { role: "STAFF" },
        { role: "LOCATION", resourceCode: "CAB-B" },
        { role: "LOCATION", resourceCode: "CAB-A" },
        { role: "EQUIPMENT", resourceCode: "  " },
      ]),
    ).toEqual(["CAB-A", "CAB-B"]);
  });

  it("formats grid cell from requirement rows", () => {
    expect(displayPhysicalResourceCodes([{ role: "STAFF" }])).toBe("—");
    expect(
      displayPhysicalResourceCodes([
        { role: "LOCATION", resourceCode: "P1" },
        { role: "LOCATION", resourceCode: "P2" },
      ]),
    ).toBe("P1, P2");
  });

  it("expands selected codes into one physical row each and keeps STAFF", () => {
    const next = applyPhysicalResourcePool(
      [{ role: "STAFF", staffMode: "SOFT", required: true }],
      ["CAB-KABINA-PARAFIN-1", "CAB-KABINA-PARAFIN-2"],
      () => "ROOM",
    );
    expect(next.filter((r) => r.role === "LOCATION").map((r) => r.resourceCode)).toEqual([
      "CAB-KABINA-PARAFIN-1",
      "CAB-KABINA-PARAFIN-2",
    ]);
    expect(next.filter((r) => r.role === "STAFF")).toHaveLength(1);
  });
});
