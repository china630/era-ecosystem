import {
  applyCcfToEad,
  calculateEclBatch,
  calculateLoanEcl,
  discountEclLab,
  resolveSicr,
  STAGE_RATES,
  weightedMacroEcl,
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

  it("PD_LGD applies collateral only via LGD (not also via EAD)", () => {
    const matrices = {
      pdByStage: { "1": 0.02, "2": 0.08, "3": 0.3 } as const,
      lgdUnsecured: 0.5,
      lgdSecuredFloor: 0.1,
    };
    const r = calculateLoanEcl(
      {
        loanId: "L4",
        outstandingMinor: 1_000_000n,
        stage: 1,
        collateralAmountMinor: 500_000n,
        akbScore: 700,
      },
      "PD_LGD",
      matrices,
    );
    // EAD = full outstanding (collateral not netted twice)
    expect(r.eadMinor).toBe(1_000_000n);
    // LGD = 0.5*(1-0.5)+0.1*0.5 = 0.3
    expect(r.lgd).toBeCloseTo(0.3, 10);
    // ECL = 1e6 * 0.02 * 0.3 = 6000
    expect(r.eclMinor).toBe(6_000n);
    // Double-count bug would have been EAD 500k * 0.02 * 0.3 = 3000
    expect(r.eclMinor).not.toBe(3_000n);
  });

  it("SICR forbearance/watch promotes stage 1→2", () => {
    expect(
      resolveSicr(
        {
          loanId: "s1",
          outstandingMinor: 100n,
          stage: 1,
          collateralAmountMinor: 0n,
          forbearance: true,
        },
        1,
      ),
    ).toBe(true);
    const r = calculateLoanEcl({
      loanId: "s2",
      outstandingMinor: 1_000_000n,
      stage: 1,
      collateralAmountMinor: 0n,
      watchList: true,
    });
    expect(r.stage).toBe(2);
    expect(r.sicrTriggered).toBe(true);
    expect(r.eclMinor).toBe(100_000n);
  });

  it("applies CCF undrawn and lifetime PD for stage 2", () => {
    expect(applyCcfToEad(1_000_000n, 500_000n, 0.5)).toBe(1_250_000n);
    const r = calculateLoanEcl(
      {
        loanId: "L5",
        outstandingMinor: 1_000_000n,
        stage: 2,
        collateralAmountMinor: 0n,
        undrawnMinor: 200_000n,
      },
      "PD_LGD",
      {
        pdByStage: { "1": 0.02, "2": 0.08, "3": 0.3 },
        lifetimePdByStage: { "1": 0.02, "2": 0.12, "3": 0.4 },
        lgdUnsecured: 0.5,
        lgdSecuredFloor: 0.1,
        ccfUndrawn: 0.5,
      },
    );
    expect(r.eadMinor).toBe(1_100_000n);
    expect(r.lifetimePd).toBe(0.12);
    expect(r.pd).toBe(0.08);
    // ECL = 1.1e6 * 0.12 * 0.5 = 66_000
    expect(r.eclMinor).toBe(66_000n);
  });

  it("weights macro scenarios and discounts with EIR lab stub", () => {
    const base = 10_000n;
    const weighted = weightedMacroEcl(base, {
      pdByStage: { "1": 0.02, "2": 0.08, "3": 0.3 },
      lgdUnsecured: 0.5,
      lgdSecuredFloor: 0.1,
      macroWeights: { base: 0.5, upside: 0.2, downside: 0.3 },
      macroEclMultipliers: { base: 1, upside: 0.8, downside: 1.4 },
    });
    // 0.5*1 + 0.2*0.8 + 0.3*1.4 = 0.5+0.16+0.42 = 1.08 → 10800
    expect(weighted).toBe(10_800n);
    expect(discountEclLab(10_000n, 0.1).eclMinor).toBe(9_091n);
    expect(discountEclLab(10_000n, 0.1).discounted).toBe(true);
  });
});
