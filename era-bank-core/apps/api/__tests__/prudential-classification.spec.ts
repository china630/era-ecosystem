import type { PrudentialCategory } from "@era/bank-core-database";
import {
  classifyCategoryFromDpd,
  classifyLoanPrudential,
  resolveWorstCategory,
  type PrudentialRateRow,
} from "../src/modules/risk/prudential-classification.engine";

/** Lab seed mirrors `prudential_rate_tables` DPD buckets (CBAR MVP). */
const LAB_RATE_TABLE: PrudentialRateRow[] = [
  {
    category: "QENAETBEXS",
    dpdMin: 0,
    dpdMax: 0,
    provisionRate: 0.015,
    rateLabel: "1-2%",
  },
  {
    category: "NEZARET",
    dpdMin: 1,
    dpdMax: 34,
    provisionRate: 0.06,
    rateLabel: "2-10%",
  },
  {
    category: "ELAVE_RISK",
    dpdMin: 35,
    dpdMax: 90,
    provisionRate: 0.15,
    rateLabel: "10-20%",
  },
  {
    category: "QEYRI_QENAETBEXS",
    dpdMin: 91,
    dpdMax: 180,
    provisionRate: 0.25,
    rateLabel: "25%",
  },
  {
    category: "TEHLUKELI",
    dpdMin: 181,
    dpdMax: 360,
    provisionRate: 0.5,
    rateLabel: "50%",
  },
  {
    category: "UMIDSIZ",
    dpdMin: 361,
    dpdMax: null,
    provisionRate: 1.0,
    rateLabel: "100%",
  },
];

const DPD_CASES: Array<{ dpd: number; expected: PrudentialCategory }> = [
  { dpd: 0, expected: "QENAETBEXS" },
  { dpd: 35, expected: "ELAVE_RISK" },
  { dpd: 95, expected: "QEYRI_QENAETBEXS" },
  { dpd: 200, expected: "TEHLUKELI" },
  { dpd: 400, expected: "UMIDSIZ" },
];

describe("prudential-classification", () => {
  it.each(DPD_CASES)(
    "classifies DPD $dpd as $expected",
    ({ dpd, expected }) => {
      expect(classifyCategoryFromDpd(dpd, LAB_RATE_TABLE)).toBe(expected);
    },
  );

  it("takes worst of DPD bucket and quality flag", () => {
    const dpdCat = classifyCategoryFromDpd(0, LAB_RATE_TABLE);
    expect(dpdCat).toBe("QENAETBEXS");
    const worst = resolveWorstCategory(dpdCat, "TEHLUKELI");
    expect(worst).toBe("TEHLUKELI");
  });

  it("provision = outstanding × rate", () => {
    const outstanding = 1_000_000n;
    const r = classifyLoanPrudential(
      { loanId: "ln-1", outstandingMinor: outstanding, dpd: 95 },
      LAB_RATE_TABLE,
    );
    expect(r.category).toBe("QEYRI_QENAETBEXS");
    expect(r.rate).toBe(0.25);
    expect(r.provisionMinor).toBe(250_000n);
  });

  it("quality flag upgrades category above DPD bucket", () => {
    const r = classifyLoanPrudential(
      {
        loanId: "ln-2",
        outstandingMinor: 100_000n,
        dpd: 10,
        qualityFlags: ["DOUBTFUL"],
      },
      LAB_RATE_TABLE,
    );
    expect(r.category).toBe("TEHLUKELI");
    expect(r.rate).toBe(0.5);
    expect(r.provisionMinor).toBe(50_000n);
  });
});