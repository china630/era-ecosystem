import { Matches, ValidateIf } from "class-validator";

export class AdminBillingCoverageDto {
  /**
   * Last covered Asia/Baku calendar day (`YYYY-MM-DD`, inclusive).
   * `null` clears coverage; the next monthly run bills the org as usual.
   */
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "coveredUntil must be YYYY-MM-DD" })
  coveredUntil!: string | null;
}
