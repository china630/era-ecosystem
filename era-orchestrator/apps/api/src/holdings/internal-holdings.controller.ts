import { Controller, Get, Headers, Param, Query } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertInternalServiceToken } from "../common/utils/internal-service-token.util";
import { HoldingsService } from "./holdings.service";

@Public()
@Controller("internal/v1/holdings")
export class InternalHoldingsController {
  constructor(private readonly holdings: HoldingsService) {}

  private guard(auth?: string, xToken?: string) {
    assertInternalServiceToken(
      auth,
      "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
      xToken,
    );
  }

  @Get()
  listForUser(
    @Query("userId") userId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.holdings.listHoldingsForReportAccess(userId);
  }

  @Get(":id")
  getForUser(
    @Param("id") id: string,
    @Query("userId") userId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.holdings.getHoldingForUserInternal(userId, id);
  }
}
