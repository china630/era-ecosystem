import { ApiPropertyOptional } from "@nestjs/swagger";
import { CounterpartyLegalForm, CounterpartyRole } from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateCounterpartyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "VÖEN, 10 цифр" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  taxId?: string;

  @ApiPropertyOptional({ enum: CounterpartyLegalForm })
  @IsOptional()
  @IsEnum(CounterpartyLegalForm)
  legalForm?: CounterpartyLegalForm;

  @ApiPropertyOptional({ enum: CounterpartyRole })
  @IsOptional()
  @IsEnum(CounterpartyRole)
  role?: CounterpartyRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: "ISO 3166-1 alpha-2 country code" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "Плательщик НДС по данным e-taxes lookup" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVatPayer?: boolean;

  @ApiPropertyOptional({
    description: "Язык гостевого портала счёта: az | ru | en",
  })
  @IsOptional()
  @IsString()
  @IsIn(["az", "ru", "en"])
  portalLocale?: "az" | "ru" | "en";

  @ApiPropertyOptional({
    description: "Срок оплаты (дней) для dueDate по умолчанию; null clears",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number | null;
}
