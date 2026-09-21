import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class TradeCreditCounterpartyActionDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;
}
