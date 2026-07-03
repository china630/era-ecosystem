import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

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

  @ApiPropertyOptional({ description: "Hint for MDM resolve when FIN not found" })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
