import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { GeoService } from "./geo.service";

@ApiTags("geo")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("geo")
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get("countries")
  @ApiOperation({ summary: "Countries catalog" })
  countries() {
    return this.geo.countries();
  }

  @Get("cities")
  @ApiOperation({ summary: "Cities catalog" })
  cities(@Query("country") country?: string) {
    return this.geo.cities(country);
  }
}
