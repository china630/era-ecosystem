import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreatePayApplicationLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceActId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

export class CreatePayApplicationDto {
  @ApiProperty()
  @IsUUID()
  contractId!: string;

  @ApiProperty({ example: "PA-2026-001" })
  @IsString()
  @MinLength(1)
  number!: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodFrom?: string;

  @ApiPropertyOptional({ example: "2026-01-31" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodTo?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retentionPct?: number;

  @ApiPropertyOptional({ type: [CreatePayApplicationLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePayApplicationLineDto)
  lines?: CreatePayApplicationLineDto[];

  @ApiPropertyOptional({
    description: "When true, seed lines from contract SOV",
  })
  @IsOptional()
  fromSov?: boolean;
}
