import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { WorkforceSeatService } from "./workforce-seat.service";

type SeatCheckBody = {
  organizationId: string;
  globalPersonId?: string;
  cpEmploymentId?: string;
};

@ApiTags("licensing-seats")
@Public()
@Controller("internal/v1/licensing/seats")
export class LicensingSeatsController {
  constructor(
    private readonly seats: WorkforceSeatService,
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

  @Post("check")
  @ApiOperation({ summary: "Canonical workforce seat check (one person one seat)" })
  async check(
    @Body() body: SeatCheckBody,
    @Headers("authorization") auth?: string,
  ) {
    this.assertToken(auth);
    return this.seats.checkSeatPolicy(body.organizationId, {
      globalPersonId: body.globalPersonId,
      cpEmploymentId: body.cpEmploymentId,
    });
  }
}
