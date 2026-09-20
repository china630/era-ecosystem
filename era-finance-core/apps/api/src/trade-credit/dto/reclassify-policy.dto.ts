import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class ReclassifyTradeCreditPolicyDto {
  @ApiPropertyOptional({
    description: "When omitted, reclassify all facilities for the org",
  })
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;
}
