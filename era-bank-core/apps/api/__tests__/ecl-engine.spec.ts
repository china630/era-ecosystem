import {
  calculateEclBatch,
  calculateLoanEcl,
  STAGE_RATES,
} from "../src/modules/risk/ecl.engine";

describe("ecl.engine stage flat rates", () => {
  it("uses stage rates 1%/10%/50%", () => {
    expect(STAGE_RATES[1]).toBe(0.01);
    expect(STAGE_RATES[2]).toBe(0.1);
    expect(STAGE_RATES[3]).toBe(0.5);
  });

  it("applies collateral haircut to EAD then stage rate", () => {
    const r = calculateLoanEcl({
      loanId: "L1",
      outstandingMinor: 1_000_000n,
      stage: 1,
      collateralAmountMinor: 200_000n,
    });
    expect(r.eadMinor).toBe(800_000n);
    expect(r.eclMinor).toBe(8_000n); // 1%
  });

  it("stage 3 uses 50%", () => {
    const r = calculateLoanEcl({
      loanId: "L2",
      outstandingMinor: 100_000n,
      stage: 3,
      collateralAmountMinor: 0n,
    });
    expect(r.eclMinor).toBe(50_000n);
  });

  it("batch totals and delta vs previous", () => {
    const batch = calculateEclBatch([
      {
        loanId: "a",
        outstandingMinor: 1_000_000n,
        stage: 1,
        collateralAmountMinor: 0n,
      },
      {
        loanId: "b",
        outstandingMinor: 100_000n,
        stage: 2,
        collateralAmountMinor: 0n,
      },
    ]);
    expect(batch.totalEclMinor).toBe(20_000n); // 10k + 10k
    const previousTotal = 5_000n;
    const delta = batch.totalEclMinor - previousTotal;
    expect(delta).toBe(15_000n);
  });

  it("PD_LGD uses matrices", () => {
    const r = calculateLoanEcl(
      {
        loanId: "L3",
        outstandingMinor: 1_000_000n,
        stage: 1,
        collateralAmountMinor: 0n,
        akbScore: 700,
      },
      "PD_LGD",
      {
        pdByStage: { "1": 0.02, "2": 0.08, "3": 0.3 },
        lgdUnsecured: 0.5,
        lgdSecuredFloor: 0.1,
      },
    );
    expect(r.pd).toBe(0.02);
    expect(r.lgd).toBe(0.5);
    expect(r.eclMinor).toBe(10_000n); // 1e6 * 0.02 * 0.5
  });
});
