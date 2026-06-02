import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { IbanService } from "./iban.service";

@ApiTags("iban")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("iban")
export class IbanController {
  constructor(private readonly iban: IbanService) {}

  @Get("validate")
  @ApiOperation({ summary: "Validate AZ IBAN and resolve branch when possible" })
  validate(@Query("iban") iban: string) {
    return this.iban.validate(iban);
  }
}
