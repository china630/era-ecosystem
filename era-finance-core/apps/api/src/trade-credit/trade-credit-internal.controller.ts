import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { ConsumeTradeCreditGrantDto } from "./dto/consume-trade-credit-grant.dto";
import { TradeCreditService } from "./trade-credit.service";

@ApiTags("internal")
@Controller("internal/v1/trade-credit")
@Public()
export class TradeCreditInternalController {
  constructor(private readonly tradeCredit: TradeCreditService) {}

  private authorize(authorization?: string, xServiceToken?: string) {
    const auth = assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
        "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
        "FINANCE_INTERNAL_SERVICE_TOKEN",
      ],
      authorization,
      xServiceToken,
    });
    if (!auth.ok) {
      throw new UnauthorizedException(auth.error);
    }
  }

  @Get("facility")
  @ApiOperation({
    summary:
      "Residual-only facility snapshot for satellites (no A–D / policy fields)",
  })
  async getFacilityResidual(
    @Query("organizationId") organizationId: string | undefined,
    @Query("counterpartyId") counterpartyId: string | undefined,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    const org = organizationId?.trim();
    const cp = counterpartyId?.trim();
    if (!org || !cp) {
      throw new BadRequestException(
        "organizationId and counterpartyId query params are required",
      );
    }
    // Buyer-shaped view — never includes policyGroup
    return this.tradeCredit.getFacilityView(org, cp);
  }

  @Post("grants/consume")
  @ApiOperation({
    summary:
      "Consume pickup grant (Wholesale / satellite; service token)",
  })
  consume(
    @Body() dto: ConsumeTradeCreditGrantDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    return this.tradeCredit.consumeGrant({
      organizationId: dto.organizationId,
      counterpartyId: dto.counterpartyId,
      code: dto.code,
      amount: dto.amount,
      sourceEntityType: dto.sourceEntityType,
      sourceEntityId: dto.sourceEntityId,
    });
  }
}
