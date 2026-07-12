import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { CurrenciesService } from "./currencies.service";

@ApiTags("currencies")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("currencies")
export class CurrenciesController {
  constructor(private readonly currencies: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: "Active ISO 4217 currency catalog" })
  list() {
    return this.currencies.list();
  }
}
