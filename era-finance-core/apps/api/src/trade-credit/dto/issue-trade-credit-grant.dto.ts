import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class IssueTradeCreditGrantDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty({ example: 250 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    description: "Finance override when amount exceeds residual",
  })
  @IsOptional()
  @IsBoolean()
  override?: boolean;

  @ApiPropertyOptional({
    description: "Required when override is true",
  })
  @ValidateIf((o: IssueTradeCreditGrantDto) => o.override === true)
  @IsString()
  @MinLength(3)
  reason?: string;

  @ApiPropertyOptional({
    description: "TTL hours (default 24)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  ttlHours?: number;
}
