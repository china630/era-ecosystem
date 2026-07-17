import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class LinkPurchaseDto {
  @ApiProperty({ description: "Posted purchase invoice transaction id" })
  @IsUUID()
  transactionId!: string;
}
