import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export const BUDGET_YEAR_MODES = ["GOV", "MANAGEMENT"] as const;
export type BudgetYearMode = (typeof BUDGET_YEAR_MODES)[number];

export class CreateBudgetLineDto {
  @ApiProperty({ example: "221" })
  @IsString()
  @MinLength(1)
  accountCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limitAnnual!: number;

  @ApiPropertyOptional({
    description: 'Monthly caps keyed by "01".."12"',
    example: { "01": 1000, "02": 1000 },
  })
  @IsOptional()
  @IsObject()
  limitMonthly?: Record<string, number>;
}

export class CreateBudgetYearDto {
  @ApiProperty({ example: 2027 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({
    enum: BUDGET_YEAR_MODES,
    default: "GOV",
    description: "GOV = B2G NAS-Gov; MANAGEMENT = commercial simplified articles",
  })
  @IsOptional()
  @IsIn(BUDGET_YEAR_MODES)
  mode?: BudgetYearMode;

  @ApiPropertyOptional({ type: [CreateBudgetLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  lines?: CreateBudgetLineDto[];
}
