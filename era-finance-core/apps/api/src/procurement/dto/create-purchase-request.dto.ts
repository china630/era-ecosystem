import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CreatePurchaseRequestLineDto } from "./create-purchase-request-line.dto";

export class CreatePurchaseRequestDto {
  @ApiPropertyOptional({ example: "PR-2026-001" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  number?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  neededByDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preferredCounterpartyId?: string;

  @ApiPropertyOptional({ type: [CreatePurchaseRequestLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRequestLineDto)
  lines?: CreatePurchaseRequestLineDto[];
}
