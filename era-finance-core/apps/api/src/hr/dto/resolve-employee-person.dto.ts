import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, ValidateIf } from "class-validator";

export class ResolveEmployeePersonDto {
  @ApiPropertyOptional({ example: "1A2B3C4" })
  @IsOptional()
  @IsString()
  fin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passport?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuingCountry?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: ResolveEmployeePersonDto) => !o.firstName?.trim() || !o.lastName?.trim())
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: ResolveEmployeePersonDto) => !o.fullName?.trim())
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: ResolveEmployeePersonDto) => !o.fullName?.trim())
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
