import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../auth/decorators/public.decorator";
import { ReferenceDataService } from "./reference-data.service";
import { ValidateReferenceDataKeyDto } from "./dto/validate-reference-data-key.dto";

@ApiTags("platform-reference-data")
@Controller("platform/reference-data/v1")
export class ReferenceDataController {
  constructor(
    private readonly referenceData: ReferenceDataService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("validate-key")
  @ApiOperation({ summary: "Validate ERA Data Hub API key (internal)" })
  async validateKey(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-control-plane-service-token") serviceToken: string | undefined,
    @Body() body: ValidateReferenceDataKeyDto,
  ) {
    const expected = this.config.get<string>("CONTROL_PLANE_SERVICE_TOKEN")?.trim();
    const bearer = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : undefined;
    const token = (serviceToken ?? bearer ?? "").trim();
    if (!expected || token !== expected) {
      throw new UnauthorizedException("Service token required");
    }
    return this.referenceData.validateKey(body);
  }
}
