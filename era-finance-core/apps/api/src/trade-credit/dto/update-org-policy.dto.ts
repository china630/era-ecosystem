import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateTradeCreditOrgPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRaiseEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  autoDMaxDpd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  autoRaisePct?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  autoRaiseCapAzn?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grantTtlHoursA?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grantTtlHoursB?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grantTtlHoursC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  groupCRequireConfirm?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPaidInvoices?: number;

  @ApiPropertyOptional({
    description:
      "Phase 2b: when true, enrich riskyTaxpayer forces group D (default informational)",
  })
  @IsOptional()
  @IsBoolean()
  enrichRiskyForcesD?: boolean;

  @ApiPropertyOptional({
    description:
      "Phase 2b: when true, enrich voenInactive forces group D (default informational)",
  })
  @IsOptional()
  @IsBoolean()
  enrichVoenInactiveForcesD?: boolean;

  @ApiPropertyOptional({ description: "Phase 3: working-capital k multiplier" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limitK?: number;

  @ApiPropertyOptional({ description: "Phase 3: thin-history trial cap AZN" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  trialLimitAzn?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  suggestedCapAzn?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  groupMultB?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  groupMultC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  partialPayHaircut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  partialPayThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  concentrationHaircut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  concentrationThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  enrichTtlDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  enrichHaircut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  restoreProposalEnabled?: boolean;
}
