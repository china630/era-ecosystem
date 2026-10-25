import { Controller, Get, Headers, Query, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { OrganizationId } from "../common/org-id.decorator";
import { EqaimeSubmissionService } from "../invoices/eqaime-submission.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";

@ApiTags("internal")
@Controller("internal/v1/qaime-day-close")
@Public()
export class QaimeDayCloseInternalController {
  constructor(private readonly eqaime: EqaimeSubmissionService) {}

  @Get()
  @ApiOperation({
    summary:
      "Invoices for one Baku date that hold the hotel night audit when the org rule is on. Does not submit.",
  })
  async list(
    @OrganizationId() organizationId: string,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-service-token") xServiceToken: string | undefined,
    @Query("date") date: string,
  ) {
    const auth = assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "FINANCE_INTERNAL_SERVICE_TOKEN",
        "FINANCE_SERVICE_TOKEN",
      ],
      authorization,
      xServiceToken,
    });
    if (!auth.ok) throw new UnauthorizedException(auth.error);
    return runWithTenantContextAsync({ organizationId, skipTenantFilter: false }, () =>
      this.eqaime.dayClose(organizationId, date ?? ""),
    );
  }
}
