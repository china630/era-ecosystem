import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class DisposeFixedAssetDto {
  @ApiPropertyOptional({ description: "Sale proceeds in AZN" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proceeds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
