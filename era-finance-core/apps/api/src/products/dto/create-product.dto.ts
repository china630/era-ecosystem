import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: "Артикул. Обязателен и для товара, и для услуги." })
  @IsString()
  @MinLength(1)
  sku!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  price!: number;

  @ApiProperty({
    description:
      "НДС, %: 18, 8, 2, 0 или -1 (освобождение от ƏDV; в расчётах как 0%)",
  })
  @Type(() => Number)
  @IsNumber()
  @IsIn([-1, 0, 2, 8, 18])
  vatRate!: number;

  @ApiPropertyOptional({ description: "Услуга (без складского учёта в UI / печать)" })
  @IsOptional()
  @IsBoolean()
  isService?: boolean;

  @ApiPropertyOptional({
    description: "Код счёта выручки NAS. Обязателен для услуги. Для товара-ингредиента можно не передавать.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  revenueAccountCode?: string;

  @ApiPropertyOptional({
    description: "Код единицы измерения из системного каталога (pcs, kg, m, m2, pack, litre, hour)",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  unitOfMeasureCode?: string;
}
