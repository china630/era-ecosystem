import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Public } from "./decorators/public.decorator";
import type { EraJwtPayload } from "./jwt-payload.type";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { SsoExchangeDto } from "./dto/sso-exchange.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Public()
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

  @Public()
  @Post("token/refresh")
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
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

  @Post("satellite-sso-ticket")
  @UseGuards(JwtAuthGuard)
  createSatelliteSsoTicket(
    @CurrentUser() user: EraJwtPayload,
    @Body() body: { organizationId?: string },
  ) {
    return this.auth.createSatelliteSsoTicket({
      userId: user.sub,
      email: user.email,
      organizationId: body.organizationId ?? user.organizationId ?? null,
      role: user.role ? String(user.role) : null,
    });
  }

  @Public()
  @Post("finance-handoff/redeem")
  redeemFinanceHandoff(@Body() body: { ticket: string }) {
    return this.auth.redeemFinanceHandoffTicket(body.ticket?.trim() ?? "");
  }
}
