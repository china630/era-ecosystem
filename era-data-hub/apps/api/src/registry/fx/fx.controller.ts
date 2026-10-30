import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { FxService } from "./fx.service";

@ApiTags("fx")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("fx")
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get("display-codes")
  @ApiOperation({ summary: "Dashboard and CBAR-check currency codes from hub settings" })
  displayCodes() {
    return this.fx.getDisplayCodes();
  }

  @Get("rates")
  @ApiOperation({
    summary:
      "Official CBAR FINAL rates on date. fallback=previous returns the latest earlier FINAL when that date has none (dashboard only).",
  })
  rates(
    @Query("date") date?: string,
    @Query("symbols") symbols?: string,
    @Query("fallback") fallback?: string,
  ) {
    return this.fx.getRates(date, symbols, fallback);
  }

  @Get("rates/range")
  @ApiOperation({ summary: "Rate series for one currency" })
  ratesRange(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("symbol") symbol: string,
  ) {
    return this.fx.getRatesRange(from, to, symbol);
  }

  @Get("convert")
  @ApiOperation({ summary: "Convert amount via AZN cross-rate" })
  convert(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("amount") amount: string,
    @Query("date") date?: string,
  ) {
    return this.fx.convert(from, to, amount, date);
  }
}
