import { Controller, Get, Logger } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { LandingMarketingService } from "./landing-marketing.service";

/**
 * Public read-only landing module cards (AZ/RU marketing copy).
 */
@Public()
@Controller("v1/public/landing-modules")
export class PublicLandingController {
  private readonly logger = new Logger(PublicLandingController.name);

  constructor(private readonly landing: LandingMarketingService) {}

  @Get()
  async list() {
    try {
      return await this.landing.listPublicLandingModules();
    } catch (e) {
      this.logger.warn(
        `public landing-modules fallback: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { items: [] as unknown[], unavailable: true as const };
    }
  }
}
