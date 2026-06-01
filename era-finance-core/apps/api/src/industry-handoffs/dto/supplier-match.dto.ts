import { IsOptional, IsString, IsUUID } from "class-validator";

export class SupplierMatchDto {
  @IsString()
  invoiceRef!: string;

  @IsOptional()
  @IsUUID()
  purchaseTransactionId?: string;

  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @IsOptional()
  @IsString()
  supplierVoen?: string;
}
