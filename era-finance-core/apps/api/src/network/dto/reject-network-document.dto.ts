import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RejectNetworkDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
