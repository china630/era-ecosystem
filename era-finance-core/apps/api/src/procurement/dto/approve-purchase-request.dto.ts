import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PurchaseRequestApprovalDecision } from "@erafinance/database";

export class ApprovePurchaseRequestDto {
  @ApiProperty({ enum: PurchaseRequestApprovalDecision })
  @IsEnum(PurchaseRequestApprovalDecision)
  decision!: PurchaseRequestApprovalDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
