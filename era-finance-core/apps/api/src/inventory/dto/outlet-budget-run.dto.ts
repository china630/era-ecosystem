import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class PlanByClassDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  CHEMICAL?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  CONSUMABLE?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  TABLEWARE?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  INVENTORY_GT?: number;
}

export class OutletBudgetRunDto {
  @ApiProperty({ example: "2026-10-27" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ example: "2026-11-02" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  satelliteOutletCode?: string;

  @ApiPropertyOptional({ type: PlanByClassDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanByClassDto)
  planByClass?: PlanByClassDto;

  @ApiPropertyOptional({ description: "Days the saved/inline plan represents (default 7)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  planPeriodDays?: number;
}

export class SaveOutletBudgetPlanDto {
  @ApiPropertyOptional({
    description: "Outlet code key; omit for org default (_)",
  })
  @IsOptional()
  @IsString()
  satelliteOutletCode?: string | null;

  @ApiProperty({ type: PlanByClassDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PlanByClassDto)
  planByClass!: PlanByClassDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  planPeriodDays?: number;
}
