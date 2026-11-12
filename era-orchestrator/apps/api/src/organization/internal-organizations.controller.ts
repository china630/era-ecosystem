import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { parsePublicOrgNumberParam } from "./public-org-number";
import { GuestAppService } from "./guest-app.service";
import { OrganizationProfileService } from "./organization-profile.service";
import { OrgAccessCredentialService } from "../admin/org-access-credential.service";

@Public()
@Controller("internal/v1/organizations")
export class InternalOrganizationsController {
  constructor(
    private readonly profiles: OrganizationProfileService,
    private readonly access: OrgAccessCredentialService,
    private readonly guestApp: GuestAppService,
  ) {}

  /**
   * S2S lookup for satellite login resolve (orgNo → UUID).
   * Soft-deleted orgs are not found (same as unknown).
   */
  @Get("by-public-number/:orgNo")
  async byPublicNumber(
    @Param("orgNo") orgNoRaw: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    const orgNo = parsePublicOrgNumberParam(orgNoRaw);
    if (orgNo == null) {
      throw new NotFoundException("Organization not found");
    }
    const org = await this.profiles.findByPublicNumber(orgNo);
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return {
      organizationId: org.id,
      publicOrgNumber: org.publicOrgNumber,
      name: org.name,
    };
  }

  /** S2S guest-app brand. Same payload as the public phone read. Not letterhead. */
  @Get(":id/guest-app-snapshot")
  async guestAppSnapshot(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    return this.guestApp.getBrand(organizationId);
  }

  /** S2S branding snapshot for satellite print / letterhead (CP-ORG-PROFILE-01). */
  @Get(":id/profile-snapshot")
  async profileSnapshot(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    return this.profiles.getSnapshot(organizationId);
  }

  /**
   * S2S: Finance publishes primary bank line into CP profile (CP-ORG-PROFILE-01 Track A).
   * Body: `{ bankLine: string | null }`.
   */
  @Patch(":id/profile-bank-line")
  async patchProfileBankLine(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() body: { bankLine?: string | null },
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    const bankLine =
      body?.bankLine === undefined || body.bankLine === null
        ? null
        : String(body.bankLine);
    return this.profiles.patchBankLineFromService(organizationId, bankLine);
  }

  /** Finance reads this org's connector key. Bearer service token. Inactive codes are not found. */
  @Get(":id/access/:code")
  async accessMaterial(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("code") code: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    return this.access.resolveForService(organizationId, code);
  }
}
