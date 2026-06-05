import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class LookupFinDto {
  @ApiProperty({ example: "1A2B3C4" })
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  fin!: string;
}
