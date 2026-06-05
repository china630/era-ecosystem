import { IsEnum, IsOptional, IsUUID } from "class-validator";

export enum OrgOperatingModeDto {
  STANDALONE = "STANDALONE",
  DEPARTMENT = "DEPARTMENT",
}

export enum OrgRoutingDto {
  OWN = "OWN",
  PARENT = "PARENT",
}

export class SetOperatingModeDto {
  @IsEnum(OrgOperatingModeDto)
  mode!: OrgOperatingModeDto;

  /** Required when mode = DEPARTMENT: the parent (e.g. hotel) organization. */
  @IsOptional()
  @IsUUID()
  parentOrgId?: string;

  @IsOptional()
  @IsEnum(OrgRoutingDto)
  fiscalRouting?: OrgRoutingDto;

  @IsOptional()
  @IsEnum(OrgRoutingDto)
  revenueRouting?: OrgRoutingDto;
}
