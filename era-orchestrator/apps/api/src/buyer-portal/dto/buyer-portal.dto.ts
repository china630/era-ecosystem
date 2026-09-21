import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class BuyerPortalLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class BuyerPortalPickOrgDto {
  @IsUUID()
  grantId!: string;
}

export class BuyerPortalInviteDto {
  @IsUUID()
  organizationId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @Matches(/^\d{10}$/)
  voen!: string;

  @IsString()
  @MinLength(1)
  financeCounterpartyId!: string;

  /** Initial password when creating a new account; omit to auto-generate. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class BuyerPortalSetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class BuyerPortalRevokeGrantDto {
  @IsUUID()
  grantId!: string;

  @IsUUID()
  organizationId!: string;
}
