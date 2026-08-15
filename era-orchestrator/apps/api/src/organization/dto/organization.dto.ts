import { UserRole } from "@era365/database";
import { IsEmail, IsEnum, IsOptional } from "class-validator";

export class JoinOrgDto {
  taxId!: string;
  message?: string;
}

export class ApproveAccessDto {
  role?: UserRole;
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
}
