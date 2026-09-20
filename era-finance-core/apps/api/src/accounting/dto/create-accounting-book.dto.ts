import { AccountingBookGaapKind } from "@erafinance/database";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export enum AccountingBookCoaStrategy {
  TEMPLATE = "TEMPLATE",
  EMPTY = "EMPTY",
  NAS_CLONE = "NAS_CLONE",
}

export class CreateAccountingBookDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameAz!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameRu!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nameEn!: string;

  @IsEnum(AccountingBookGaapKind)
  gaapKind!: AccountingBookGaapKind;

  @IsOptional()
  @IsBoolean()
  seedCoa?: boolean;

  @IsOptional()
  @IsEnum(AccountingBookCoaStrategy)
  coaStrategy?: AccountingBookCoaStrategy;

  @IsOptional()
  @IsBoolean()
  translateFromStatutory?: boolean;
}
