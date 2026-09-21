import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { PrismaService } from "../prisma/prisma.service";
import { parsePublicOrgNumberParam } from "./public-org-number";

@Public()
@Controller("internal/v1/organizations")
export class InternalOrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

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
}
