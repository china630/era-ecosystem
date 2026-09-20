import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  return false;
}

export class KafeOnboardDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  cafeName!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  taxId!: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  zal?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  kitchen?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  qrMenu?: boolean;
}
