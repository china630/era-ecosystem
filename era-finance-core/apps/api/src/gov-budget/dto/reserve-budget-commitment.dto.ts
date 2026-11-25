import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export const BUDGET_COMMITMENT_REF_TYPES = [
  "PURCHASE_INVOICE",
  "BUDGET_EXPENSE_EXECUTION",
  "CONTRACT_COMMITMENT",
  "PAYMENT",
  "CONSTRUCTION_ACT",
  "PURCHASE_REQUEST",
] as const;

export class ReserveBudgetCommitmentDto {
  @ApiProperty()
  @IsUUID()
  budgetLineId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @ApiProperty({ enum: BUDGET_COMMITMENT_REF_TYPES })
  @IsIn(BUDGET_COMMITMENT_REF_TYPES)
  referenceType!: (typeof BUDGET_COMMITMENT_REF_TYPES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  referenceId!: string;

  @ApiPropertyOptional({
    description: "When true, refuse if remaining < amount (hard gate)",
  })
  @IsOptional()
  @IsBoolean()
  hardGate?: boolean;
}
