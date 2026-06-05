import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from "class-validator";

export class CreateOverheadPoolDto {
  @ApiProperty({ example: "2026-05", description: "Calendar month YYYY-MM (UTC)" })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  totalAmount!: number;

  @ApiProperty({ description: "NAS account code for accumulated overhead source (reference)" })
  @IsString()
  @MinLength(1)
  sourceAccountCode!: string;

  @ApiPropertyOptional({
    description: "Credit NAS code; default from MANUFACTURING_OVERHEAD_CREDIT posting role",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  creditAccountCode?: string;

  @ApiPropertyOptional({
    description: "Debit NAS code; default from FINISHED_GOODS posting role",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  debitAccountCode?: string;

  @ApiProperty()
  @IsUUID()
  driverId!: string;
}
