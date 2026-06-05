import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { NETWORK_INBOUND_DEBIT_ROLES } from "../network-settings.util";

export class AcceptNetworkDocumentDto {
  @ApiProperty({ enum: NETWORK_INBOUND_DEBIT_ROLES })
  @IsString()
  @IsIn([...NETWORK_INBOUND_DEBIT_ROLES])
  debitRole!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  claimsVat?: boolean;

  @ApiPropertyOptional({ example: "2026-06-05" })
  @IsOptional()
  @IsDateString()
  postingDate?: string;
}
