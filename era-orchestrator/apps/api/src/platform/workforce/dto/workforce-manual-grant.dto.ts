import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateManualGrantDto {
  @IsUUID()
  employmentId!: string;

  @IsString()
  @MinLength(1)
  satelliteKey!: string;

  @IsString()
  @MinLength(1)
  satelliteRole!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ListManualGrantsQueryDto {
  @IsOptional()
  @IsUUID()
  employmentId?: string;
}
