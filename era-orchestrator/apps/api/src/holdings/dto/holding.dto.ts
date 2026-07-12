import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { HoldingAccessRole } from "@era365/database";

export class CreateHoldingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(["AZN", "USD", "EUR", "RUB", "TRY"])
  baseCurrency?: string;
}

export class UpdateHoldingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(["AZN", "USD", "EUR", "RUB", "TRY"])
  baseCurrency?: string;
}

export class AddHoldingMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(HoldingAccessRole)
  role!: HoldingAccessRole;
}

export class UpdateHoldingMemberDto {
  @IsEnum(HoldingAccessRole)
  role!: HoldingAccessRole;
}
