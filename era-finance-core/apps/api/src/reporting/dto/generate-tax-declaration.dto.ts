import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";

const TAX_TYPES = [
  "SIMPLIFIED_TAX",
  "PROFIT_TAX",
  "PAYROLL_WITHHOLDING",
  "PROPERTY_TAX",
] as const;

export type TaxDeclarationDtoType = (typeof TAX_TYPES)[number];

export class GenerateTaxDeclarationDto {
  @ApiProperty({
    enum: TAX_TYPES,
    example: "SIMPLIFIED_TAX",
  })
  @IsString()
  @IsIn([...TAX_TYPES])
  taxType!: TaxDeclarationDtoType;

  @ApiProperty({
    description:
      "Reporting period: YYYY-MM for SIMPLIFIED_TAX / PAYROLL_WITHHOLDING, YYYY for PROFIT_TAX / PROPERTY_TAX",
    example: "2026-04",
  })
  @IsString()
  @Matches(/^(\d{4}-(0[1-9]|1[0-2])|\d{4})$/)
  period!: string;
}
