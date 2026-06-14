import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PurchaseRequestStatus } from "@erafinance/database";
import { CreatePurchaseRequestLineDto } from "./create-purchase-request-line.dto";

export class UpdatePurchaseRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  neededByDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preferredCounterpartyId?: string | null;

  @ApiPropertyOptional({ enum: PurchaseRequestStatus })
  @IsOptional()
  @IsEnum(PurchaseRequestStatus)
  status?: PurchaseRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseTransactionId?: string | null;

  @ApiPropertyOptional({ type: [CreatePurchaseRequestLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRequestLineDto)
  lines?: CreatePurchaseRequestLineDto[];
}
