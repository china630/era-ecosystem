import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
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
  @ValidateIf((o: AddHoldingMemberDto) => !o.email)
  @IsUUID()
  userId?: string;

  @ValidateIf((o: AddHoldingMemberDto) => !o.userId)
  @IsEmail()
  email?: string;

  @IsEnum(HoldingAccessRole)
  role!: HoldingAccessRole;
}

export class UpdateHoldingMemberDto {
  @IsEnum(HoldingAccessRole)
  role!: HoldingAccessRole;
}
