import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

/** Buyer may not set TTL — group C policy TTL must apply. */
export class BuyerIssueTradeCreditGrantDto {
  @ApiProperty({ example: 250 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
