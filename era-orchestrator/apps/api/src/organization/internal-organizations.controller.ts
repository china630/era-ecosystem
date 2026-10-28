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
import { PrismaService } from "../prisma/prisma.service";
import { parsePublicOrgNumberParam } from "./public-org-number";
import { OrganizationProfileService } from "./organization-profile.service";

@Public()
@Controller("internal/v1/organizations")
export class InternalOrganizationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: OrganizationProfileService,
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
    const org = await this.prisma.organization.findFirst({
      where: { publicOrgNumber: orgNo, deletedAt: null },
      select: { id: true, publicOrgNumber: true, name: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return {
      organizationId: org.id,
      publicOrgNumber: org.publicOrgNumber,
      name: org.name,
    };
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
}
