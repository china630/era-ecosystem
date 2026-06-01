import { IsOptional, IsString, IsUUID } from "class-validator";

export class EligibilityCheckDto {
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  patientFin?: string;
}
