import { Controller, Get } from "@nestjs/common";
import { Public } from "./decorators/public.decorator";
import { AuthService } from "./auth.service";

@Controller(".well-known")
export class WellKnownController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get("jwks.json")
  jwks() {
    return this.auth.jwksStub();
  }
}
