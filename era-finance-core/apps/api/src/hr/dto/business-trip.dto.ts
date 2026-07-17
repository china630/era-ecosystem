import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BusinessTripKind } from "@erafinance/database";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateBusinessTripDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ enum: BusinessTripKind })
  @IsEnum(BusinessTripKind)
  kind!: BusinessTripKind;

  @ApiProperty({ example: "BAK" })
  @IsString()
  regionCode!: string;

  @ApiProperty({ example: "2026-07-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-07-05" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class UpdateBusinessTripDto {
  @ApiPropertyOptional({ enum: BusinessTripKind })
  @IsOptional()
  @IsEnum(BusinessTripKind)
  kind?: BusinessTripKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class CreatePerDiemNormDto {
  @ApiProperty({ example: "BAK" })
  @IsString()
  regionCode!: string;

  @ApiProperty({ example: "Bakı" })
  @IsString()
  regionName!: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyAznDomestic!: number;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  foreignFactor?: number;
}

export class UpdatePerDiemNormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyAznDomestic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  foreignFactor?: number;
}
