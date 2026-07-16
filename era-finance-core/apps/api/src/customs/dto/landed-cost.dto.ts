import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

export type LandedCostAllocationMethod = "STAT_VALUE" | "WEIGHT" | "QUANTITY";

export class AllocateLandedCostDto {
  @ApiPropertyOptional({
    enum: ["STAT_VALUE", "WEIGHT", "QUANTITY"],
    default: "STAT_VALUE",
    description: "Basis for distributing duty/fees/excise across declaration lines",
  })
  @IsOptional()
  @IsIn(["STAT_VALUE", "WEIGHT", "QUANTITY"])
  method?: LandedCostAllocationMethod;
}

export class PatchCustomsDeclarationItemDto {
  @ApiProperty({ description: "Catalog product linked to this BGD line for landed-cost allocation" })
  @IsUUID()
  productId!: string;
}

export class RunImportPipelineDto {
  @ApiProperty({ description: "Completed OCR job id (foreign supplier invoice)" })
  @IsUUID()
  ocrJobId!: string;

  @ApiPropertyOptional({ description: "Customs declaration to link and allocate landed cost" })
  @IsOptional()
  @IsUUID()
  customsDeclarationId?: string;

  @ApiPropertyOptional({
    enum: ["STAT_VALUE", "WEIGHT", "QUANTITY"],
    default: "STAT_VALUE",
  })
  @IsOptional()
  @IsIn(["STAT_VALUE", "WEIGHT", "QUANTITY"])
  landedCostMethod?: LandedCostAllocationMethod;
}
