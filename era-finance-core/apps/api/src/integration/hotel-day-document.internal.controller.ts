import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { satelliteHotelNightAuditClosedSchema } from "@era/contracts";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { OrganizationId } from "../common/org-id.decorator";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { SatelliteEventDispatchService } from "./satellite-event-dispatch.service";

@ApiTags("internal")
@Controller("internal/v1/hotel-day-document")
@Public()
export class HotelDayDocumentInternalController {
  constructor(private readonly dispatch: SatelliteEventDispatchService) {}

  @Post()
  @ApiOperation({ summary: "Post the hotel day document now and keep a rejection for the morning" })
  async submit(
    @OrganizationId() organizationId: string,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
    @Body() body?: unknown,
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
    const event = satelliteHotelNightAuditClosedSchema.parse(body);
    const result = await runWithTenantContextAsync(
      { organizationId, skipTenantFilter: false },
      () => this.dispatch.postHotelNightAuditEvent(organizationId, event),
    );
    return {
      posted: result.meta?.rejected !== true,
      rejected: result.meta?.rejected === true,
      error: typeof result.meta?.error === "string" ? result.meta.error : undefined,
      transactionId: result.transactionId ?? null,
      businessDate: event.payload.businessDate,
    };
  }
}
