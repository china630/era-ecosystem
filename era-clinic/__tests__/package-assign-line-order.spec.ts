import { chunkCreatedIdsByLine } from "@/domain/sanatorium/package-assign.service";

describe("chunkCreatedIdsByLine", () => {
  it("keeps modal add order: first line ids, then next line ids", () => {
    const chunks = chunkCreatedIdsByLine(
      ["n1", "n2", "e1", "i1", "v1"],
      [
        { procedureCode: "SVC-NAFTALAN-VANNASI-QADIN", qty: 2 },
        { procedureCode: "SVC-ELEKTRO-TERAPIYA", qty: 1 },
        { procedureCode: "SVC-INFRAQIRMIZI", qty: 1 },
        { procedureCode: "SVC-VAKUUM-TERAPIYA", qty: 1 },
      ],
    );
    expect(chunks.map((row) => row.procedureCode)).toEqual([
      "SVC-NAFTALAN-VANNASI-QADIN",
      "SVC-ELEKTRO-TERAPIYA",
      "SVC-INFRAQIRMIZI",
      "SVC-VAKUUM-TERAPIYA",
    ]);
    expect(chunks[0]?.ids).toEqual(["n1", "n2"]);
    expect(chunks[1]?.ids).toEqual(["e1"]);
  });
});
