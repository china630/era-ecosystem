import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";
import { TradeCreditFacilityStatus } from "@erafinance/database";

export class UpsertTradeCreditFacilityDto {
  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  stopList?: boolean;

  @ApiPropertyOptional({ enum: TradeCreditFacilityStatus })
  @IsOptional()
  @IsEnum(TradeCreditFacilityStatus)
  status?: TradeCreditFacilityStatus;
}
