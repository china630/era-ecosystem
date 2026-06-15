import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SignatoryRole } from "@era/bank-core-database";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { DboService } from "./dbo.service";

class RegisterCredentialDto {
  @IsString()
  customerId!: string;

  @IsString()
  loginHash!: string;

  @IsOptional()
  @IsString()
  passwordHash?: string;
}

class OtpChallengeDto {
  @IsString()
  customerId!: string;

  @IsString()
  codeHash!: string;

  @IsDateString()
  expiresAt!: string;
}

class SignatoryDto {
  @IsString()
  customerId!: string;

  @IsString()
  globalPersonId!: string;

  @IsEnum(SignatoryRole)
  role!: SignatoryRole;

  @IsOptional()
  @IsString()
  limitMinor?: string;
}

@ApiTags("dbo")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("dbo")
export class DboController {
  constructor(private readonly dbo: DboService) {}

  @Post("credentials")
  credentials(@Body() dto: RegisterCredentialDto) {
    return this.dbo.registerCredential(dto);
  }

  @Post("otp-challenges")
  otp(@Body() dto: OtpChallengeDto) {
    return this.dbo.createOtpChallenge(dto.customerId, dto.codeHash, new Date(dto.expiresAt));
  }

  @Post("signatories")
  signatory(@Body() dto: SignatoryDto) {
    return this.dbo.addSignatory({
      ...dto,
      limitMinor: dto.limitMinor ? BigInt(dto.limitMinor) : undefined,
    });
  }
}
