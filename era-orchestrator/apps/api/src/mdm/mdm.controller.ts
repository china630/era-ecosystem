import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { MdmService } from "./mdm.service";
import type { ResolvePersonInput } from "./mdm-person-identity.types";

@Public()
@Controller("internal/v1/mdm")
export class MdmController {
  constructor(private readonly mdm: MdmService) {}

  private guard(auth?: string, xToken?: string) {
    this.mdm.assertServiceToken(auth, xToken);
  }

  @Get("health")
  health() {
    return this.mdm.healthCheck();
  }

  @Post("organizations/register")
  registerOrg(
    @Body()
    body: { name: string; taxId: string; ownerUserId?: string },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.registerOrganization(body);
  }

  @Post("persons/lookup-by-fin")
  lookupByFin(
    @Body()
    body: { fin: string; requesterOrgId?: string; purpose?: string },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.lookupNaturalPersonByFin(body);
  }

  @Post("persons/resolve")
  resolvePerson(
    @Body() body: ResolvePersonInput,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.resolvePersonIdentity(body);
  }

  @Post("persons/merge")
  mergePersons(
    @Body()
    body: {
      sourcePersonId: string;
      targetPersonId: string;
      actorOrgId?: string;
    },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.mergePersons(body);
  }

  @Get("persons/:personId/identifiers")
  listIdentifiers(
    @Param("personId") personId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.listPersonIdentifiers(personId);
  }

  @Post("persons")
  upsertPerson(
    @Body()
    body: ResolvePersonInput,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.upsertNaturalPerson(body);
  }

  @Post("organizations/lookup-by-voen")
  lookupByVoen(
    @Body() body: { taxId: string },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.lookupOrganizationByVoen(body.taxId ?? "");
  }

  @Post("organizations/link")
  linkOrg(
    @Body()
    body: { organizationId: string; name: string; taxId: string },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.linkExistingOrganization(body);
  }

  @Post("access-requests")
  accessRequest(
    @Body()
    body: { personId: string; requesterOrgId: string; purpose: string },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.createAccessRequestStub(body);
  }

  @Post("guest-qr/issue")
  issueGuestQr(
    @Body() body: { globalPersonId: string; ttlSeconds?: number },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.issueGuestQr(body);
  }

  @Post("guest-qr/verify")
  verifyGuestQr(
    @Body() body: { token: string },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.mdm.verifyGuestQr(body);
  }
}
