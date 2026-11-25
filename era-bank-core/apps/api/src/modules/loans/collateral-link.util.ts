import { BadRequestException } from "@nestjs/common";
import { serializeCollateral } from "./loan-risk.util";

export function validateCollateralSharePct(sharePct: number): void {
  if (!Number.isFinite(sharePct) || sharePct <= 0 || sharePct > 100) {
    throw new BadRequestException(
      "sharePct must be a number greater than 0 and at most 100",
    );
  }
}

/** Legacy `collateralRef` JSON snapshot while entity links roll out (P1-9). */
export function collateralEntitySnapshot(input: {
  description?: string | null;
  type: string;
  valuationMinor: bigint;
  currency: string;
}): string {
  return serializeCollateral({
    description: input.description ?? input.type,
    amountMinor: input.valuationMinor.toString(),
    currency: input.currency,
    type: input.type,
  });
}