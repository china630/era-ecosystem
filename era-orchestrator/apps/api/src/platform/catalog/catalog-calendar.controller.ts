import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
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
@Controller("platform/v1/catalog/calendar")
export class CatalogCalendarController {
  constructor(private readonly catalog: CatalogGatewayService) {}

  private orgId(req: Record<string, string | undefined>): string {
    return req[SATELLITE_ORG_ID_KEY]!;
  }

  @Get(":country/day")
  @ApiOperation({ summary: "Production calendar day (proxy to data-hub)" })
  getDay(
    @Param("country") country: string,
    @Query("date") date: string,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.getCalendarDay(country, date, this.orgId(req));
  }

  @Get(":country/days")
  @ApiOperation({ summary: "Bulk calendar days" })
  getDays(
    @Param("country") country: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.getCalendarDaysRange(
      country,
      from,
      to,
      this.orgId(req),
    );
  }

  @Get(":country/is-working-day")
  @ApiOperation({ summary: "Working day check" })
  isWorking(
    @Param("country") country: string,
    @Query("date") date: string,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.isWorkingDay(country, date, this.orgId(req));
  }

  @Get(":country/add-business-days")
  @ApiOperation({ summary: "Add business days" })
  addBusiness(
    @Param("country") country: string,
    @Query("date") date: string,
    @Query("n") n: string,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.addBusinessDays(
      country,
      date,
      Number(n),
      this.orgId(req),
    );
  }
}
