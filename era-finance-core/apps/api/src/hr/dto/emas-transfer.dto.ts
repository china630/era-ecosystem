import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class EmasTransferDto {
  @ApiPropertyOptional({ description: "New position title" })
  @IsOptional()
  @IsString()
  positionTitle?: string;

  @ApiPropertyOptional({ description: "New department name" })
  @IsOptional()
  @IsString()
  departmentName?: string;

  @ApiPropertyOptional({ description: "New gross monthly salary (AZN)" })
  @IsOptional()
  @IsString()
  salaryGrossAzn?: string;

  @ApiPropertyOptional({ description: "Transfer effective date (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
