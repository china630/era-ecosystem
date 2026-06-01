import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class ExternalPurchaseLineDto {
  @IsString()
  sku!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class ExternalPurchaseDto {
  @IsString()
  externalRef!: string;

  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalPurchaseLineDto)
  lines!: ExternalPurchaseLineDto[];
}
