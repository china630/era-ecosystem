import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { EraJwtPayload } from "./jwt-payload.type";
import { AuthService } from "./auth.service";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterOrganizationDto } from "./dto/register-organization.dto";
import type { RegisterUserDto } from "./dto/register-user.dto";
import type { SsoExchangeDto } from "./dto/sso-exchange.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post("register-user")
  registerUser(@Body() body: RegisterUserDto) {
    return this.auth.registerUser(body);
  }

  @Post("register-organization")
  @UseGuards(JwtAuthGuard)
  registerOrganization(
    @CurrentUser() user: EraJwtPayload,
    @Body() body: RegisterOrganizationDto,
  ) {
    return this.auth.registerOrganizationForUser(user.sub, body);
  }

  @Post("token/refresh")
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("sso/exchange")
  ssoExchange(@Body() body: SsoExchangeDto) {
    return this.auth.ssoExchange(body);
  }

  @Post("finance-handoff")
  @UseGuards(JwtAuthGuard)
  createFinanceHandoff(@CurrentUser() user: EraJwtPayload) {
    return this.auth.createFinanceHandoffTicket({
      userId: user.sub,
      organizationId: user.organizationId ?? null,
    });
  }

  @Post("finance-handoff/redeem")
  redeemFinanceHandoff(@Body() body: { ticket: string }) {
    return this.auth.redeemFinanceHandoffTicket(body.ticket?.trim() ?? "");
  }
}
