import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsString, IsUUID, Min, MinLength } from "class-validator";

export class ConsumeTradeCreditGrantDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;

  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty({ description: "Plaintext pickup grant code" })
  @IsString()
  @MinLength(8)
  code!: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: "WHOLESALE_SHIPMENT" })
  @IsString()
  @MinLength(1)
  sourceEntityType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sourceEntityId!: string;
}
