import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertFiscalHardwareDeviceDto {
  @IsIn(["FISCAL_KKM", "BANK_POS"])
  kind!: "FISCAL_KKM" | "BANK_POS";

  @IsString()
  @MaxLength(64)
  providerId!: string;

  @IsString()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  outletCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registerCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  serial?: string | null;

  @IsOptional()
  @IsObject()
  externalIds?: Record<string, string> | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  endpoint?: string | null;

  /** Plain secrets object — encrypted at rest; omit to leave unchanged. */
  @IsOptional()
  @IsObject()
  secrets?: Record<string, string> | null;

  @IsOptional()
  @IsIn(["active", "retired"])
  status?: "active" | "retired";

  @IsOptional()
  @IsBoolean()
  isOrgDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isOutletDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isRegisterDefault?: boolean;
}
