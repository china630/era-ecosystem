import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { OrganizationId } from "../common/org-id.decorator";
import { ProductsService } from "./products.service";

@ApiTags("internal")
@Controller("internal/v1/products")
export class InternalProductsController {
  constructor(private readonly products: ProductsService) {}

  private authorize(authorization?: string, xServiceToken?: string) {
    const auth = assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
        "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
        "FINANCE_INTERNAL_SERVICE_TOKEN",
      ],
      authorization,
      xServiceToken,
    });
    if (!auth.ok) {
      throw new UnauthorizedException(auth.error);
    }
  }

  @Get()
  @ApiOperation({
    summary: "Search inventory products for satellite TTK pickers (service token)",
  })
  async search(
    @OrganizationId() organizationId: string,
    @Query("search") search?: string,
    @Query("isService") isService?: string,
    @Query("limit") limitRaw?: string,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const rows = await this.products.list(organizationId, {
      isService: isService ?? "false",
      search,
      limit,
    });
    return rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      isService: p.isService,
    }));
  }
}
