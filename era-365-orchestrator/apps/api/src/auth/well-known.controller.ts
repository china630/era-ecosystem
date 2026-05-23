import { Controller, Get } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller(".well-known")
export class WellKnownController {
  constructor(private readonly auth: AuthService) {}

  @Get("jwks.json")
  jwks() {
    return this.auth.jwksStub();
  }
}
