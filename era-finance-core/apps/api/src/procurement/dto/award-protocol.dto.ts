import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

export class AwardProcurementProtocolDto {
  @ApiPropertyOptional({
    description: "Winning bid id when isWinner was not set on create/update",
  })
  @IsOptional()
  @IsUUID()
  winnerBidId?: string;

  @ApiPropertyOptional({ enum: ["CONSTRUCTION", "SUPPLY", "SERVICE", "OTHER"] })
  @IsOptional()
  @IsIn(["CONSTRUCTION", "SUPPLY", "SERVICE", "OTHER"])
  contractType?: "CONSTRUCTION" | "SUPPLY" | "SERVICE" | "OTHER";
}
