import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LookupFinDto {
  @ApiProperty({ example: "1A2B3C4" })
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  fin!: string;

  @ApiPropertyOptional({ description: "Full name for MDM resolve-or-create when lookup misses" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;
}
