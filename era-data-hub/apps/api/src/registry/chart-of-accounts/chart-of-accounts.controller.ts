import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { ChartOfAccountsService } from "./chart-of-accounts.service";

@ApiTags("chart-of-accounts")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("chart-of-accounts")
export class ChartOfAccountsController {
  constructor(private readonly coa: ChartOfAccountsService) {}

  @Get()
  @ApiOperation({ summary: "National chart of accounts template (read-only)" })
  get(@Query("profile") profile = "commercial") {
    return this.coa.get(profile);
  }
}
