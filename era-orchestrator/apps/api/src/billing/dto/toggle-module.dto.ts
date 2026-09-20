import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class ToggleModuleDto {
  @ApiProperty({
    example: "cash_bank_pro",
    description: "Ключ модуля из каталога `pricing_modules`",
  })
  @IsString()
  @MinLength(1)
  moduleKey!: string;

  @ApiProperty({ description: "Включить (true) или выключить (false) модуль" })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({
    description:
      "For stackable `accounting_book_extra`: number of EXTRA book slots (1–7). Ignored when enabled=false. Default 1 when enabling without quantity.",
    minimum: 1,
    maximum: 7,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  quantity?: number;
}
