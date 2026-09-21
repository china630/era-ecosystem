import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class InviteBuyerPortalDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiPropertyOptional({
    description: "Initial password when creating account; omit to auto-generate",
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
