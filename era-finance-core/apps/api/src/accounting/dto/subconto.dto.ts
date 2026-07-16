import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SubcontoKind } from "@erafinance/database";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from "class-validator";

export class CreateSubcontoTypeDto {
  @ApiProperty({ example: "PROJECT_ALPHA" })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: "Project Alpha" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: SubcontoKind })
  @IsEnum(SubcontoKind)
  kind!: SubcontoKind;
}

export class UpdateSubcontoTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class CreateAccountSubcontoConfigDto {
  @ApiProperty()
  @IsUUID()
  accountId!: string;

  @ApiProperty()
  @IsUUID()
  subcontoTypeId!: string;

  @ApiProperty({ minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1)
  @Max(3)
  sortOrder!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class UpdateAccountSubcontoConfigDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
