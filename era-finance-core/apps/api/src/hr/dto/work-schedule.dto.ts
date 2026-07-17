import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WorkScheduleKind } from "@erafinance/database";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateWorkScheduleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: WorkScheduleKind })
  @IsEnum(WorkScheduleKind)
  kind!: WorkScheduleKind;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dayHours?: number;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nightPremiumRate?: number;

  @ApiPropertyOptional({ example: 1.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eveningPremiumRate?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimePremiumRate?: number;
}

export class UpdateWorkScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: WorkScheduleKind })
  @IsOptional()
  @IsEnum(WorkScheduleKind)
  kind?: WorkScheduleKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dayHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nightPremiumRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eveningPremiumRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimePremiumRate?: number;
}
