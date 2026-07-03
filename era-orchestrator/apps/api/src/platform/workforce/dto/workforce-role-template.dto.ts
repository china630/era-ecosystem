import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpsertRoleTemplateDto {
  @IsUUID()
  positionId!: string;

  @IsString()
  @MinLength(1)
  satelliteKey!: string;

  @IsString()
  @MinLength(1)
  satelliteRole!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ListRoleTemplatesQueryDto {
  @IsOptional()
  @IsUUID()
  positionId?: string;
}
