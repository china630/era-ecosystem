import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class UpdateProfitTaxAdjustmentDto {
  @ApiPropertyOptional({ enum: ["PERMANENT", "TEMPORARY"] })
  @IsOptional()
  @IsString()
  @IsIn(["PERMANENT", "TEMPORARY"])
  kind?: "PERMANENT" | "TEMPORARY";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,4})?$/)
  amount?: string;
}
