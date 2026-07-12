import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class EmasHireDto {
  @ApiPropertyOptional({ description: "Contract start date override (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ description: "Gross monthly salary override (AZN)" })
  @IsOptional()
  @IsString()
  salaryGrossAzn?: string;
}
