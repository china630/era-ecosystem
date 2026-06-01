import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  taxId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;
}
