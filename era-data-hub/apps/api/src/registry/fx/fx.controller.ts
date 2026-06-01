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

  @Get("rates")
  @ApiOperation({ summary: "Official CBAR rates on date" })
  rates(@Query("date") date?: string, @Query("symbols") symbols?: string) {
    return this.fx.getRates(date, symbols);
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
