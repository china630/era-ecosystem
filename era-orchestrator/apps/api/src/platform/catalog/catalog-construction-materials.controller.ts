import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
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
@Controller("platform/v1/catalog/construction-materials")
export class CatalogConstructionMaterialsController {
  constructor(private readonly catalog: CatalogGatewayService) {}

  @Get()
  @ApiOperation({ summary: "Construction materials list (proxy to data-hub)" })
  list(
    @Query("q") q: string | undefined,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.listConstructionMaterials(req[SATELLITE_ORG_ID_KEY]!, q);
  }

  @Get(":code")
  @ApiOperation({ summary: "Construction material by code (proxy to data-hub)" })
  getByCode(
    @Param("code") code: string,
    @Req() req: Record<string, string | undefined>,
  ) {
    return this.catalog.getConstructionMaterial(code, req[SATELLITE_ORG_ID_KEY]!);
  }
}
