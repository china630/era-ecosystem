import { Controller, Get, Logger, Param, Query } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { SiteCatalogService } from "./site-catalog.service";

@Public()
@Controller("v1/public/site-catalog")
export class PublicSiteCatalogController {
  private readonly logger = new Logger(PublicSiteCatalogController.name);

  constructor(private readonly catalog: SiteCatalogService) {}

  @Get()
  async list(@Query("locale") locale?: string) {
    try {
      return await this.catalog.getPublicCatalog(locale);
    } catch (e) {
      this.logger.warn(
        `public site-catalog fallback: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        cacheVersion: 0,
        satellites: [],
        industries: [],
        unavailable: true as const,
      };
    }
  }

  @Get("satellites/:publicSlug")
  async satellite(
    @Param("publicSlug") publicSlug: string,
    @Query("locale") locale?: string,
  ) {
    return this.catalog.getPublicSatellite(publicSlug, locale);
  }

  @Get("industries/:slug")
  async industry(
    @Param("slug") slug: string,
    @Query("locale") locale?: string,
  ) {
    return this.catalog.getPublicIndustry(slug, locale);
  }
}
