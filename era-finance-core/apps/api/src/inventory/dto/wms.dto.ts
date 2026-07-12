import { Type } from "class-transformer";
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateWarehouseZoneDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  zoneType?: string;
}

export class UpdateWarehouseZoneDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  zoneType?: string;
}

export class WmsScanQueryDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class WmsReceiveToBinDto {
  @IsUUID()
  binId!: string;

  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class WmsIssueFromBinDto {
  @IsUUID()
  binId!: string;

  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class WmsTransferBinDto {
  @IsUUID()
  sourceBinId!: string;

  @IsUUID()
  targetBinId!: string;

  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class WmsAdjustBinDto {
  @IsUUID()
  binId!: string;

  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  quantityDelta!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class WmsPutAwaySuggestQueryDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  productId!: string;
}

export class CreatePickListDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}

export class ConfirmPickLineDto {
  @IsUUID()
  lineId!: string;

  @IsOptional()
  @IsString()
  binBarcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity?: number;
}
