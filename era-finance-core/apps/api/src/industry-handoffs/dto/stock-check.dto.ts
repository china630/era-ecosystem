import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class StockCheckDto {
  @IsString()
  sku!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualQty?: number;

  @IsOptional()
  @IsString()
  barcode?: string;
}
