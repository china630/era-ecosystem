import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class PatchInvoiceDto {
  @ApiPropertyOptional({ enum: ["DOMESTIC", "EXPORT", "IMPORT"] })
  @IsOptional()
  @IsIn(["DOMESTIC", "EXPORT", "IMPORT"])
  tradeContext?: "DOMESTIC" | "EXPORT" | "IMPORT";

  @ApiPropertyOptional({ example: "FOB", description: "Incoterms 2020 code" })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  incoterms?: string;

  @ApiPropertyOptional({ description: "Export customs declaration reference" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  exportDeclarationRef?: string;

  @ApiPropertyOptional({ description: "Country of destination (ISO or free text)" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  countryOfDestination?: string;

  @ApiPropertyOptional({
    description: "FX rate document currency → AZN (export revenue recognition)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0000001)
  fxRateToAzn?: number;
}
