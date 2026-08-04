import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { PayrollComponentKind } from "@erafinance/database";

export class CreatePayrollComponentDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsIn(["EARNING", "DEDUCTION"])
  kind!: PayrollComponentKind;

  @IsString()
  @MinLength(1)
  nameAz!: string;

  @IsString()
  @MinLength(1)
  nameRu!: string;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
