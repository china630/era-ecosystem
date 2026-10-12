import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateNasSubaccountDto {
  @ApiProperty({ example: "601" })
  @IsString()
  @MinLength(1)
  parentCode!: string;

  @ApiProperty({ example: "601.1", description: "Dotted analytical code. Hyphen is rejected." })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: "Spirits" })
  @IsString()
  @MinLength(1)
  name!: string;
}
