import { ArrayMinSize, IsArray, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateCommsThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  recipientUserIds!: string[];
}

export class ReplyCommsThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;
}
