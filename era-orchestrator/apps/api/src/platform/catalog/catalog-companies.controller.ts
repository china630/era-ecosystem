import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
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
@Controller("platform/v1/catalog/companies")
export class CatalogCompaniesController {
  constructor(private readonly catalog: CatalogGatewayService) {}

  @Get(":voen")
  @ApiOperation({ summary: "VÖEN company directory lookup (proxy to data-hub)" })
  getByVoen(
    @Param("voen") voen: string,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.companyByVoen(voen, req[SATELLITE_ORG_ID_KEY]!);
  }
}
