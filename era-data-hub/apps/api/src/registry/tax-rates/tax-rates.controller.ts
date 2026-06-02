import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { TaxRatesService } from "./tax-rates.service";

@ApiTags("tax-rates")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("tax-rates")
export class TaxRatesController {
  constructor(private readonly taxRates: TaxRatesService) {}

  @Get()
  @ApiOperation({ summary: "Tax rates effective on date" })
  list(@Query("type") type?: string, @Query("date") date?: string) {
    return this.taxRates.onDate(type, date);
  }
}
