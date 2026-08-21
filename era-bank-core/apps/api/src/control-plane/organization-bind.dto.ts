import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class OrganizationBindBodyDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  boundBy?: string;
}
