import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export enum OverheadDistributionKey {
  QUANTITY = "QUANTITY",
  MATERIAL_COST = "MATERIAL_COST",
}

export class AllocateOverheadBatchDto {
  @ApiProperty({ example: "2026-05" })
  @IsString()
  period!: string;

  @ApiProperty({ description: "Total overhead pool amount (AZN)" })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  totalAmount!: number;

  @ApiProperty({ enum: OverheadDistributionKey })
  @IsEnum(OverheadDistributionKey)
  distributionKey!: OverheadDistributionKey;

  @ApiProperty({ type: [String], format: "uuid" })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  releaseIds!: string[];

  @ApiPropertyOptional({
    description: "Credit NAS code; default from MANUFACTURING_OVERHEAD_CREDIT posting role",
  })
  @IsOptional()
  @IsString()
  creditAccountCode?: string;

  @ApiPropertyOptional({
    description: "Debit NAS code; default from FINISHED_GOODS posting role",
  })
  @IsOptional()
  @IsString()
  debitAccountCode?: string;

  @ApiPropertyOptional({
    description: "Source NAS code; defaults to credit account",
  })
  @IsOptional()
  @IsString()
  sourceAccountCode?: string;
}
