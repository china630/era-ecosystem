import type { UserRole } from "@era365/database";

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
