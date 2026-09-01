import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReprovisionEmploymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  login?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pin?: string;
}
