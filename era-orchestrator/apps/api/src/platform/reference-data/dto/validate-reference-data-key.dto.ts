import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class ValidateReferenceDataKeyDto {
  @IsString()
  @MinLength(8)
  apiKey!: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
