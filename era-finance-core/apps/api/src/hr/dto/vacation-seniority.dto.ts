import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class CreateVacationSeniorityRuleDto {
  @ApiProperty({ example: 5, description: "Whole years of service from" })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsFrom!: number;

  @ApiProperty({ example: 2, description: "Extra vacation days per year" })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  extraDays!: number;
}

export class UpdateVacationSeniorityRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  extraDays?: number;
}
