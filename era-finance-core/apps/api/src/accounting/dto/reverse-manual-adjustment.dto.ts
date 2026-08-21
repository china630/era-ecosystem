import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString, MaxLength, MinLength } from "class-validator";
import { MANUAL_ADJUSTMENT_REASON_MIN } from "../manual-adjustment.constants";

export class ReverseManualAdjustmentDto {
  @ApiProperty({ example: "2026-08-20" })
  @IsDateString()
  date!: string;

  @ApiProperty({ minLength: MANUAL_ADJUSTMENT_REASON_MIN })
  @IsString()
  @MinLength(MANUAL_ADJUSTMENT_REASON_MIN)
  @MaxLength(2000)
  reason!: string;
}
