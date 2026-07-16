import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class EmasTerminateDto {
  @ApiPropertyOptional({ description: "Termination date (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @ApiPropertyOptional({ description: "Termination reason / note" })
  @IsOptional()
  @IsString()
  reason?: string;
}
