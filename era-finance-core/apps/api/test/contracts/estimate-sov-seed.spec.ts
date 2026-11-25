/**
 * Rules for Construction estimate → Finance Contract SOV seed (no GL).
 * Mirrors ContractsService.seedSovFromEstimatePackage decision table.
 */

type Decision =
  | { action: "idempotent" }
  | { action: "skip"; reason: "CONTRACT_NOT_FOUND" | "SOV_NONEMPTY_MANUAL" | "EMPTY_LINES" }
  | { action: "seed" };

function decideEstimateSovSeed(input: {
  hasContract: boolean;
  samePackCommitment: boolean;
  lineCount: number;
  hasPriorEstimateCommitment: boolean;
  incomingLineCount: number;
}): Decision {
  if (!input.hasContract) return { action: "skip", reason: "CONTRACT_NOT_FOUND" };
  if (input.samePackCommitment) return { action: "idempotent" };
  if (input.lineCount > 0 && !input.hasPriorEstimateCommitment) {
    return { action: "skip", reason: "SOV_NONEMPTY_MANUAL" };
  }
  if (input.incomingLineCount < 1) return { action: "skip", reason: "EMPTY_LINES" };
  return { action: "seed" };
}

describe("estimate SOV seed decision", () => {
  it("skips when contract missing", () => {
    expect(
      decideEstimateSovSeed({
        hasContract: false,
        samePackCommitment: false,
        lineCount: 0,
        hasPriorEstimateCommitment: false,
        incomingLineCount: 2,
      }),
    ).toEqual({ action: "skip", reason: "CONTRACT_NOT_FOUND" });
  });

  it("is idempotent when same package already committed", () => {
    expect(
      decideEstimateSovSeed({
        hasContract: true,
        samePackCommitment: true,
        lineCount: 3,
        hasPriorEstimateCommitment: true,
        incomingLineCount: 3,
      }),
    ).toEqual({ action: "idempotent" });
  });

  it("does not wipe manual SOV", () => {
    expect(
      decideEstimateSovSeed({
        hasContract: true,
        samePackCommitment: false,
        lineCount: 2,
        hasPriorEstimateCommitment: false,
        incomingLineCount: 5,
      }),
    ).toEqual({ action: "skip", reason: "SOV_NONEMPTY_MANUAL" });
  });

  it("seeds empty SOV", () => {
    expect(
      decideEstimateSovSeed({
        hasContract: true,
        samePackCommitment: false,
        lineCount: 0,
        hasPriorEstimateCommitment: false,
        incomingLineCount: 4,
      }),
    ).toEqual({ action: "seed" });
  });

  it("allows replace when prior estimate seed exists", () => {
    expect(
      decideEstimateSovSeed({
        hasContract: true,
        samePackCommitment: false,
        lineCount: 4,
        hasPriorEstimateCommitment: true,
        incomingLineCount: 6,
      }),
    ).toEqual({ action: "seed" });
  });
});
