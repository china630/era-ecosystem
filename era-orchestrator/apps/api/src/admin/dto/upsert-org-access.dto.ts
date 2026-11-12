import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertOrgAccessDto {
  @IsOptional()
  @IsObject()
  publicFields?: Record<string, unknown>;

  /** Write-only. Empty leaves the stored secret unchanged. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  secret?: string;
}
