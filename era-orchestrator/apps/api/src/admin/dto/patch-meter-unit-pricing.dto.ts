import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class PatchMeterUnitPricingDto {
  @ApiProperty({ description: "AZN per active user / month" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerUserMonthAzn!: number;

  @ApiProperty({ description: "AZN per GB storage / month" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerGbMonthAzn!: number;

  @ApiProperty({ description: "AZN per WhatsApp alert" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerWhatsappAlertAzn!: number;

  @ApiProperty({ description: "AZN per invoice (Baku month)" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerInvoiceAzn!: number;

  @ApiProperty({ description: "AZN per OCR page" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerOcrPageAzn!: number;

  @ApiPropertyOptional({ description: "AZN per trade credit buyer" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerTradeCreditBuyerAzn?: number;

  @ApiPropertyOptional({ description: "AZN per trade credit enrichment deep-check" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerTradeCreditEnrichAzn?: number;
}
