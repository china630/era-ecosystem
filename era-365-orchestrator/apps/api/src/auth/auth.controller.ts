import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { LoginDto } from "./dto/login.dto";
import type { SsoExchangeDto } from "./dto/sso-exchange.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post("token/refresh")
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("sso/exchange")
  ssoExchange(@Body() body: SsoExchangeDto) {
    return this.auth.ssoExchange(body);
  }
}
