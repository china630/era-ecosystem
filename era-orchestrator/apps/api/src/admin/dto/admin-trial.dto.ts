import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { DEPLOYMENT_TOPOLOGIES } from "../../subscription/license-defaults";

export class PatchTrialAllowlistDto {
  @IsArray()
  @IsString({ each: true })
  moduleKeys!: string[];
}

export class PatchSatelliteTrialDto {
  /** ISO-8601 or null / empty = perpetual at this satellite. */
  @IsOptional()
  @IsString()
  trialExpiresAt?: string | null;
}

export class PatchModuleTrialDto {
  /** ISO-8601 or null / empty = perpetual at this module. */
  @IsOptional()
  @IsString()
  trialExpiresAt?: string | null;
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

  /** Super-admin: clear trialExpiresAt + expiresAt (perpetual license). */
  @IsOptional()
  @IsBoolean()
  neverExpires?: boolean;

  /** Super-admin: shift from max(now, current expiry). Negative shrinks. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-120)
  @Max(120)
  shiftMonths?: number;
}

export class PatchDeploymentTopologyDto {
  @IsIn([...DEPLOYMENT_TOPOLOGIES])
  topology!: (typeof DEPLOYMENT_TOPOLOGIES)[number];

  /** Re-apply SHARED trial / DEDICATED+ONPREM perpetual. Explicit — does not run on topology-only save. */
  @IsOptional()
  @IsBoolean()
  applyLicenseDefault?: boolean;
}
