import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const VALUE_KINDS = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"] as const;

export class ExtraFieldOptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelRu?: string;
}

export class CreateExtraFieldDefinitionDto {
  @ApiProperty({ default: "FINANCE_INVOICE" })
  @IsString()
  @IsIn(["FINANCE_INVOICE"])
  entityType!: "FINANCE_INVOICE";

  @ApiProperty({ example: "vehicle_plate" })
  @IsString()
  @MaxLength(48)
  key!: string;

  @ApiProperty({ enum: VALUE_KINDS })
  @IsIn([...VALUE_KINDS])
  valueKind!: (typeof VALUE_KINDS)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  labelAz!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  labelEn!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  labelRu!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: [ExtraFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ExtraFieldOptionDto)
  options?: ExtraFieldOptionDto[];
}

export class PatchExtraFieldDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: [ExtraFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ExtraFieldOptionDto)
  options?: ExtraFieldOptionDto[];
}

export class PutExtraAttributesDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  extraAttributes!: Record<string, unknown>;
}
