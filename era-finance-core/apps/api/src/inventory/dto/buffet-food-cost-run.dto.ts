import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from "class-validator";

const COST_CLASSES = [
  "FOOD",
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;

export class BuffetFoodCostRunDto {
  @ApiProperty({ example: "2026-10-20" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ example: "2026-10-26" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @ApiPropertyOptional({ description: "F&B Outlet.code scope (FIN-INV-SCOPE-01)" })
  @IsOptional()
  @IsString()
  satelliteOutletCode?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warehouseIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  posSaleAzn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  posCompAzn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  staffNetAzn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  theoreticalAzn?: number;

  @ApiPropertyOptional({ default: 70 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  warningVarianceLowPct?: number;

  @ApiPropertyOptional({ default: 110 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  warningVarianceHighPct?: number;

  @ApiPropertyOptional({
    description: "Per-SKU theoretical AZN (TTK/norm) for variance rows",
    type: "object",
    additionalProperties: { type: "number" },
  })
  @IsOptional()
  @IsObject()
  theoreticalBySku?: Record<string, number>;
}

export class PatchWarehouseScopeDto {
  @ApiPropertyOptional({
    description: "Stable import key (unique per org); used by migration stock drafts",
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  code?: string | null;

  @ApiPropertyOptional({
    enum: COST_CLASSES,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(COST_CLASSES)
  costClass?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  satelliteOutletCode?: string | null;
}
