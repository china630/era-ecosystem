import { Controller, Get, HttpCode, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { buildPlatformLinks } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("public")
@Controller("public/platform-links")
@Public()
export class PlatformLinksController {
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: "Cabinet register/pricing/help URLs (Sync-backed app origin)" })
  links() {
    const body = buildPlatformLinks();
    if (!body.appOrigin) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
