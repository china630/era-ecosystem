import { chunkCreatedIdsByLine } from "@/domain/sanatorium/package-assign.service";

describe("Saxla line order + redispatch attach", () => {
  it("prepends unfinished block tail before new modal line ids", () => {
    const chunks = chunkCreatedIdsByLine(
      ["new-magnet-1", "new-ultra-1", "new-ultra-2"],
      [
        { procedureCode: "SVC-MAGNIT", qty: 1 },
        { procedureCode: "SVC-ULTRA", qty: 2 },
      ],
    );
    const redispatchedFixed = ["old-infra-1", "old-infra-2"];
    const first = [...redispatchedFixed, ...chunks[0]!.ids];
    const second = [...chunks[1]!.ids];
    expect(first).toEqual(["old-infra-1", "old-infra-2", "new-magnet-1"]);
    expect(second).toEqual(["new-ultra-1", "new-ultra-2"]);
  });
});
