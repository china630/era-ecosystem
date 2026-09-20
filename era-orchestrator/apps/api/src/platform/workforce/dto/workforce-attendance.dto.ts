import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateAttendanceDeviceDto {
  @IsUUID()
  placeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsBoolean()
  requireHmac?: boolean;
}

export class UpsertAttendanceIdentityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  personRef!: string;

  @IsUUID()
  employmentId!: string;
}

export class AttendanceRebuildDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(32)
  from?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(32)
  to?: string;

  @IsOptional()
  @IsBoolean()
  usePlannedIfOpen?: boolean;
}

export class AttendanceCsvImportDto {
  @IsUUID()
  deviceId!: string;

  @IsOptional()
  @IsString()
  csv?: string;

  /** Base64 .xlsx (same columns as CSV). */
  @IsOptional()
  @IsString()
  xlsxBase64?: string;
}
