import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { KafeOnboardDto } from "./dto/kafe-onboard.dto";
import { KafeOnboardService } from "./kafe-onboard.service";

@ApiTags("kafe")
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller("v1/public/kafe")
export class KafeOnboardController {
  constructor(private readonly kafe: KafeOnboardService) {}

  @Post("onboard")
  @ApiOperation({
    summary: "ERA Kafe signup: user + org + industry_fnb_pos on the existing SHARED F&B pool",
  })
  onboard(@Body() body: KafeOnboardDto) {
    return this.kafe.onboard(body);
  }
}
