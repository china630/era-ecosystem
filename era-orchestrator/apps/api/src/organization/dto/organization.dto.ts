import { UserRole } from "@era365/database";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class JoinOrgDto {
  taxId!: string;
  message?: string;
}

export class ApproveAccessDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  organizationRoleCode?: string;
}

export class TransferOwnershipDto {
  newOwnerUserId!: string;
}

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  organizationRoleCode?: string;
}
