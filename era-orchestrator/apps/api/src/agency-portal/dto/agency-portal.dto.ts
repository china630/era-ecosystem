import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class AgencyPortalLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class AgencyPortalPickPropertyDto {
  @IsUUID()
  grantId!: string;
}

export class AgencyPortalInviteDto {
  @IsUUID()
  organizationId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @Matches(/^\d{10}$/)
  agencyVoen!: string;

  @IsString()
  @MinLength(1)
  localAgencyId!: string;

  @IsOptional()
  @IsString()
  localAgencyCode?: string;

  /** Initial password when creating a new account; omit to auto-generate. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class AgencyPortalSetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class AgencyPortalRevokeGrantDto {
  @IsUUID()
  grantId!: string;

  @IsUUID()
  organizationId!: string;
}
