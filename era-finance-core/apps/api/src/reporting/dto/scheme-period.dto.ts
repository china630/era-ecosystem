import { IsIn, IsString, Matches, MinLength } from "class-validator";
import { TaxDeclarationType } from "@erafinance/database";

export class ApplySchemePeriodDto {
  @Matches(/^\d{4}(?:-(?:0[1-9]|1[0-2]|Q[1-4]))?$/)
  period!: string;

  @IsIn(["SIMPLIFIED_TAX", "VAT", "PROFIT_TAX", "PAYROLL_WITHHOLDING", "PROPERTY_TAX"])
  taxType!: TaxDeclarationType;
}

export class LinkProvisionalVatDto {
  @IsString()
  @MinLength(1)
  documentRef!: string;
}
