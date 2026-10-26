import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

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

  @IsOptional()
  @IsString()
  satelliteKey?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    // class-transformer 0.5.1 runs Boolean("false") === true before @Transform.
    // Read the raw query string from the source object.
    const raw =
      obj && typeof obj === "object" && "revoked" in obj
        ? (obj as { revoked?: unknown }).revoked
        : value;
    if (raw === "true" || raw === true) return true;
    if (raw === "false" || raw === false) return false;
    return undefined;
  })
  @IsBoolean()
  revoked?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  page?: number;

  @IsOptional()
  @Transform(({ value }) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  pageSize?: number;
}
