import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class SsoExchangeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsNumber()
  expiresAt!: number;

  @IsString()
  @MinLength(1)
  signature!: string;

  @IsOptional()
  @IsString()
  role?: string;
}
