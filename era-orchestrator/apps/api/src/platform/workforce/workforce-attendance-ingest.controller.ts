import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../auth/decorators/public.decorator";
import { WorkforceAttendanceService } from "./workforce-attendance.service";

/**
 * Vendor-agnostic attendance punch webhook (Evrostar wave 6).
 * Auth: per-device Bearer att_* token — NOT user JWT, NOT SATELLITE_EVENT_SERVICE_TOKEN.
 */
@ApiTags("platform-workforce-attendance-ingest")
@Public()
@Throttle({ default: { limit: 2000, ttl: 60_000 } })
@Controller("platform/v1/workforce/attendance")
export class WorkforceAttendanceIngestController {
  constructor(private readonly attendance: WorkforceAttendanceService) {}

  @Post("punches")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Ingest FaceID / tablet punches (HMAC optional). Idempotent on externalId per device.",
  })
  async ingestPunches(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-attendance-signature") signature: string | undefined,
    @Body() body: unknown,
    @Req() req: { rawBody?: Buffer | string },
  ) {
    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString("utf8")
          : JSON.stringify(body ?? {});
    const device = await this.attendance.authenticateDevice(
      authorization,
      rawBody,
      signature,
    );
    if (!device) {
      throw new UnauthorizedException();
    }
    const batch = this.attendance.parseBatch(body);
    return this.attendance.ingestPunches(device, batch, device.id);
  }
}
