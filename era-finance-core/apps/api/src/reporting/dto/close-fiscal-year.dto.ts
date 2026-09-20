import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class CloseFiscalYearDto {
  @ApiProperty({ example: 2025 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({ enum: ["NAS", "IFRS", "MANAGEMENT"] })
  @IsOptional()
  @IsIn(["NAS", "IFRS", "MANAGEMENT"])
  ledgerType?: "NAS" | "IFRS" | "MANAGEMENT";

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  accountingBookId?: string;
}
