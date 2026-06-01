import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class RateQuoteDto {
  @IsOptional()
  @IsString()
  zoneFrom?: string;

  @IsOptional()
  @IsString()
  zoneTo?: string;

  @IsNumber()
  @Min(0)
  weightKg!: number;

  @IsOptional()
  @IsString()
  serviceLevel?: string;
}
