import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { CatalogGatewayService } from "./catalog-gateway.service";
import {
  SATELLITE_ORG_ID_KEY,
  SatelliteCatalogGuard,
} from "./satellite-catalog.guard";

@ApiTags("platform-catalog")
@Public()
@UseGuards(SatelliteCatalogGuard)
@Controller("platform/v1/catalog/fx")
export class CatalogFxController {
  constructor(private readonly catalog: CatalogGatewayService) {}

  @Get("convert")
  @ApiOperation({ summary: "FX display convert (proxy to data-hub)" })
  convert(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("amount") amount: string,
    @Query("date") date: string | undefined,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.fxConvert(
      {
        from,
        to: to ?? "AZN",
        amount: Number(amount),
        date,
      },
      req[SATELLITE_ORG_ID_KEY]!,
    );
  }
}
