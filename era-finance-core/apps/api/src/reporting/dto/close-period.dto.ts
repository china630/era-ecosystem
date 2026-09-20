import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ClosePeriodDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  /** P1 per-book close (default NAS). */
  @ApiPropertyOptional({ enum: ["NAS", "IFRS", "MANAGEMENT"], default: "NAS" })
  @IsOptional()
  @IsIn(["NAS", "IFRS", "MANAGEMENT"])
  ledgerType?: "NAS" | "IFRS" | "MANAGEMENT";

  @ApiPropertyOptional({ description: "Explicit accounting book UUID" })
  @IsOptional()
  @IsUUID()
  accountingBookId?: string;
}
