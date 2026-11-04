import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { CommercialOutletStatus } from "@era365/database";

export class CreateCommercialOutletDto {
  @ApiProperty({ example: "industry_fnb_pos" })
  @IsString()
  @MinLength(1)
  satelliteKey!: string;

  @ApiProperty({ example: "cafe-main", maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/i)
  code!: string;

  @ApiProperty({ example: "Main café" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

export class UpdateCommercialOutletDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: CommercialOutletStatus })
  @IsOptional()
  @IsEnum(CommercialOutletStatus)
  status?: CommercialOutletStatus;
}

export class SuspendSatelliteDto {
  @ApiProperty({ description: "When true, sets suspendedAt and disables endpoint." })
  @IsBoolean()
  suspend!: boolean;
}
