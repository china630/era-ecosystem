import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class PatchTrialAllowlistDto {
  @IsArray()
  @IsString({ each: true })
  moduleKeys!: string[];
}

export class PatchSatelliteTrialDto {
  @IsString()
  trialExpiresAt!: string;
}

export class PatchModuleTrialDto {
  @IsString()
  trialExpiresAt!: string;
}

export class PatchOrgQuotasDto {
  @IsOptional()
  quotaOverrides?: Record<string, unknown> | null;
}

export class PatchOrgTrialDto {
  @IsOptional()
  @IsString()
  trialExpiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;
}
