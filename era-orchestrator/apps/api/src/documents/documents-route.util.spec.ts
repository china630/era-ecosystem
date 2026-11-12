import { chainEdges, stepSkipped } from "./documents-route.util";

describe("stepSkipped", () => {
  it("skips when the document kind does not match", () => {
    expect(stepSkipped({ skipUnlessKind: "INCOMING" }, { kind: "OUTGOING", amount: 2000 })).toBe(true);
  });

  it("skips when the amount is below the threshold or empty", () => {
    expect(stepSkipped({ minAmount: 1000 }, { kind: "INCOMING", amount: 500 })).toBe(true);
    expect(stepSkipped({ minAmount: 1000 }, { kind: "INCOMING", amount: null })).toBe(true);
  });

  it("runs when the amount reaches the threshold", () => {
    expect(stepSkipped({ minAmount: 1000, skipUnlessKind: "INCOMING" }, { kind: "INCOMING", amount: 1000 })).toBe(false);
  });
});

describe("chainEdges", () => {
  it("builds one start arrow and the links between 1..n", () => {
    expect(chainEdges([1, 2, 3])).toEqual([
      { fromStepOrder: null, toStepOrder: 1 },
      { fromStepOrder: 1, toStepOrder: 2 },
      { fromStepOrder: 2, toStepOrder: 3 },
    ]);
  });

  it("rejects a hole", () => {
    expect(chainEdges([1, 3])).toBeNull();
  });
});