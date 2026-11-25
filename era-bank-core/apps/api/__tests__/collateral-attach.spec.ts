import { BadRequestException } from "@nestjs/common";
import {
  collateralEntitySnapshot,
  validateCollateralSharePct,
} from "../src/modules/loans/collateral-link.util";
import { parseCollateralRef } from "../src/modules/loans/loan-risk.util";

describe("collateral attach (P1-9)", () => {
  it("rejects invalid sharePct", () => {
    expect(() => validateCollateralSharePct(0)).toThrow(BadRequestException);
    expect(() => validateCollateralSharePct(101)).toThrow(BadRequestException);
    expect(() => validateCollateralSharePct(50)).not.toThrow();
  });

  it("entity snapshot stays readable via collateralRef JSON", () => {
    const raw = collateralEntitySnapshot({
      type: "REAL_ESTATE",
      description: "Flat 12",
      valuationMinor: 500_000_00n,
      currency: "AZN",
    });
    const parsed = parseCollateralRef(raw);
    expect(parsed?.description).toBe("Flat 12");
    expect(parsed?.type).toBe("REAL_ESTATE");
    expect(parsed?.amountMinor).toBe("50000000");
  });
});