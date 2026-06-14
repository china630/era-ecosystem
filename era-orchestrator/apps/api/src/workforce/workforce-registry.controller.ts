import { Controller, Get, Headers, Param, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/decorators/public.decorator";
import { WorkforceRegistryService } from "./workforce-registry.service";

@Public()
@Controller("internal/v1/workforce")
export class WorkforceRegistryController {
  constructor(
    private readonly registry: WorkforceRegistryService,
    private readonly config: ConfigService,
  ) {}

  private assertToken(auth?: string) {
    const expected = this.config.get<string>("ORCHESTRATOR_INTERNAL_SERVICE_TOKEN");
    if (!expected) return;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : auth?.trim();
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid service token");
    }
  }

  @Get("owners/:ownerUserId/assignments")
  listForOwner(
    @Param("ownerUserId") ownerUserId: string,
    @Headers("authorization") auth?: string,
  ) {
    this.assertToken(auth);
    return this.registry.listForOwner(ownerUserId);
  }

  @Get("organizations/:organizationId/assignments")
  listForOrg(
    @Param("organizationId") organizationId: string,
    @Headers("authorization") auth?: string,
  ) {
    this.assertToken(auth);
    return this.registry.listForOrganization(organizationId);
  }
}
