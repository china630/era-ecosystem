import { Body, Controller, Get, Post } from "@nestjs/common";
import { MdmService } from "./mdm.service";

@Controller("internal/v1/mdm")
export class MdmController {
  constructor(private readonly mdm: MdmService) {}

  @Get("health")
  health() {
    return this.mdm.healthCheck();
  }

  @Post("organizations/register")
  registerOrg(
    @Body()
    body: { name: string; taxId: string; ownerUserId?: string },
  ) {
    return this.mdm.registerOrganization(body);
  }

  @Post("persons")
  upsertPerson(
    @Body()
    body: { fin?: string; fullName: string; phone?: string },
  ) {
    return this.mdm.upsertNaturalPerson(body);
  }

  @Post("organizations/lookup-by-voen")
  lookupByVoen(@Body() body: { taxId: string }) {
    return this.mdm.lookupOrganizationByVoen(body.taxId ?? "");
  }

  @Post("organizations/link")
  linkOrg(
    @Body()
    body: { organizationId: string; name: string; taxId: string },
  ) {
    return this.mdm.linkExistingOrganization(body);
  }

  @Post("access-requests")
  accessRequest(
    @Body()
    body: { personId: string; requesterOrgId: string; purpose: string },
  ) {
    return this.mdm.createAccessRequestStub(body);
  }
}
