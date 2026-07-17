import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateBidDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWinner?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateProcurementProtocolDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  number!: string;

  @ApiProperty({ example: "2026-07-13" })
  @IsDateString()
  protocolDate!: string;

  @ApiProperty({ enum: ["TENDER", "QUOTATION", "OTHER"] })
  @IsIn(["TENDER", "QUOTATION", "OTHER"])
  procedureType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  winnerCounterpartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [CreateBidDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBidDto)
  @ArrayMinSize(0)
  bids?: CreateBidDto[];
}

export class UpdateProcurementProtocolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  protocolDate?: string;

  @ApiPropertyOptional({ enum: ["TENDER", "QUOTATION", "OTHER"] })
  @IsOptional()
  @IsIn(["TENDER", "QUOTATION", "OTHER"])
  procedureType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  winnerCounterpartyId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string | null;

  @ApiPropertyOptional({ enum: ["DRAFT", "REGISTERED"] })
  @IsOptional()
  @IsIn(["DRAFT", "REGISTERED"])
  status?: "DRAFT" | "REGISTERED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ type: [CreateBidDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBidDto)
  bids?: CreateBidDto[];
}
