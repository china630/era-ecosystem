import { BadRequestException } from "@nestjs/common";
import { BankErrorCode } from "./bank-error-codes";

export function assertIdempotencyKey(key: string | undefined | null): string {
  const trimmed = key?.trim();
  if (!trimmed || trimmed.length < 8) {
    throw new BadRequestException({
      code: BankErrorCode.IDEMPOTENCY_CONFLICT,
      message: "idempotencyKey required (min 8 chars)",
    });
  }
  return trimmed;
}
