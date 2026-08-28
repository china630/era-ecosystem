import {
  deriveCoarseBodyPart,
  resolveSiteApplyMode,
  uniqueOrderedIds,
} from "@/domain/physio/physio-order-sites";

describe("physio order sites (CLI-49 W2)", () => {
  it("dedupes site ids preserving order", () => {
    expect(uniqueOrderedIds(["b", "a", "b", "  ", "a"])).toEqual(["b", "a"]);
  });

  it("derives coarse bodyPart: first unique, FULL_BODY wins", () => {
    expect(deriveCoarseBodyPart([{ coarse: ["HEAD"] }, { coarse: ["NECK"] }])).toBe("HEAD");
    expect(
      deriveCoarseBodyPart([{ coarse: ["BACK"] }, { coarse: ["FULL_BODY", "BACK"] }]),
    ).toBe("FULL_BODY");
    expect(deriveCoarseBodyPart([])).toBeNull();
    expect(deriveCoarseBodyPart([{ coarse: ["NOSE"] }])).toBeNull();
  });

  it("clears apply mode below two sites and defaults TOGETHER", () => {
    expect(resolveSiteApplyMode(1, "TURN")).toBeNull();
    expect(resolveSiteApplyMode(2, null)).toBe("TOGETHER");
    expect(resolveSiteApplyMode(3, "TURN")).toBe("TURN");
  });
});
