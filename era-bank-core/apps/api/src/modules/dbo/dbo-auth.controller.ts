import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";
import { DboAuthService } from "./dbo-auth.service";

class OtpRequestDto {
  @IsString()
  identifier!: string;

  @IsEnum(["RETAIL", "CORPORATE"] as const)
  channel!: "RETAIL" | "CORPORATE";
}

class OtpVerifyDto extends OtpRequestDto {
  @IsString()
  code!: string;
}

class AsanCallbackDto extends OtpRequestDto {
  @IsString()
  transactionId!: string;
}

@ApiTags("dbo-auth")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/auth")
export class DboAuthController {
  constructor(private readonly auth: DboAuthService) {}

  @Post("otp/request")
  otpRequest(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.identifier, dto.channel);
  }

  @Post("otp/verify")
  otpVerify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post("asan/challenge")
  asanChallenge(@Body() dto: OtpRequestDto) {
    return this.auth.startAsanChallenge(dto.identifier, dto.channel);
  }

  @Post("asan/callback")
  asanCallback(@Body() dto: AsanCallbackDto) {
    return this.auth.completeAsanCallback(dto);
  }

  @Post("logout")
  logout() {
    return { ok: true };
  }

  @Get("me")
  @UseGuards(BankCustomerAuthGuard)
  me(@Req() req: BankCustomerRequest) {
    return this.auth.me(req.customerAuth.sub);
  }
}
