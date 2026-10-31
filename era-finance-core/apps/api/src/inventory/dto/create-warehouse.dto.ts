import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const COST_CLASSES = [
  "FOOD",
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;

export class CreateWarehouseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: "Stable import key (unique per org)" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: COST_CLASSES })
  @IsOptional()
  @IsIn(COST_CLASSES)
  costClass?: (typeof COST_CLASSES)[number];

  @ApiPropertyOptional({ description: "F&B Outlet.code for cost-run scope" })
  @IsOptional()
  @IsString()
  satelliteOutletCode?: string;
}
