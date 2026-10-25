import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";
import { FACT_MEANINGS, type FactMeaningCode } from "../fact-queue";

export class ClassifyFactMeaningDto {
  @IsIn(["BANK", "CASH"])
  source!: "BANK" | "CASH";

  @IsUUID()
  id!: string;

  @IsIn(FACT_MEANINGS)
  meaning!: FactMeaningCode;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  purchaseTransactionId?: string;

  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @IsOptional()
  @IsBoolean()
  confirmMismatch?: boolean;
}
