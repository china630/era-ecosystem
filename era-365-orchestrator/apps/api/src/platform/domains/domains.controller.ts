import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { DomainsService } from "./domains.service";

@ApiTags("platform-domains")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/domains/v1")
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Post("domains")
  @ApiOperation({ summary: "Register custom domain (stub)" })
  createDomain(
    @OrganizationId() organizationId: string,
    @Body() body: unknown,
  ) {
    return this.domains.createDomain(organizationId, body);
  }
}
