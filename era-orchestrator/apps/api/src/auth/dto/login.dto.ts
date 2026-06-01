import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  /** Optional org context; defaults to first membership. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
