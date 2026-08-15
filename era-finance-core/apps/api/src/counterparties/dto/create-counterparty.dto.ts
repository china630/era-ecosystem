import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CounterpartyLegalForm, CounterpartyRole } from "@erafinance/database";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCounterpartyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "name is required" })
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: "VÖEN, 10 цифр" })
  @IsString()
  @Matches(/^\d{10}$/, { message: "taxId must be 10 digits (VÖEN)" })
  taxId!: string;

  @ApiProperty({ enum: CounterpartyLegalForm })
  @IsEnum(CounterpartyLegalForm)
  legalForm!: CounterpartyLegalForm;

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

  @ApiPropertyOptional({ description: "Для отправки счёта на почту" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "Плательщик НДС (можно подставить после Yoxla / e-taxes)",
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVatPayer?: boolean;

  @ApiPropertyOptional({
    description:
      "Язык гостевого портала счёта для клиента: az | ru | en (иначе — Accept-Language браузера)",
  })
  @IsOptional()
  @IsString()
  @IsIn(["az", "ru", "en"])
  portalLocale?: "az" | "ru" | "en";

  @ApiPropertyOptional({
    description: "Срок оплаты (дней) для dueDate по умолчанию; null = 30",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  directorName?: string;

  @ApiPropertyOptional({ type: [String], description: "E.164 phone numbers" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  phones?: string[];

  @ApiPropertyOptional({ description: "FIN for individual counterparties (7 chars)" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{7}$/)
  finCode?: string;
}
