import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class RuntimeConfigBodyDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  orchestratorEventUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  publicBaseUrl?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  @Type(() => String)
  platformSuperAdminEmails?: string[];

  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  ssoSharedSecret?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  satelliteEventServiceToken?: string;

  /** Sync entitlement snapshot (forbidNonWhitelisted must accept these). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  activeModules?: string[];

  @IsOptional()
  @IsObject()
  hotelModules?: Record<string, boolean>;

  /**
   * Placement hint only — never used to skip organizationId tenant filter.
   */
  @IsOptional()
  @IsIn(["SHARED", "DEDICATED", "ONPREM"])
  deploymentTopology?: "SHARED" | "DEDICATED" | "ONPREM";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  edition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  updatedBy?: string;
}
