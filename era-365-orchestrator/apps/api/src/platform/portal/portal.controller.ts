import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { PortalService, type CreatePortalLinkInput } from "./portal.service";

@ApiTags("platform-portal")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/portal/v1")
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get("links/:token")
  @ApiOperation({ summary: "Resolve portal link by token" })
  getLink(@Param("token") token: string) {
    return this.portal.getLink(token);
  }

  @Post("links")
  @ApiOperation({ summary: "Create portal magic link" })
  createLink(
    @OrganizationId() organizationId: string,
    @Body() body: CreatePortalLinkInput,
  ) {
    return this.portal.createLink(organizationId, body);
  }
}
