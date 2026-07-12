import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class RunIntangibleAmortizationDto {
  @ApiPropertyOptional({ example: 2024 })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  year!: number;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
