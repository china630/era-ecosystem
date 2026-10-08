import { Body, Controller, Headers, Post } from "@nestjs/common";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { EntitlementsService } from "./entitlements.service";
import type { ValidateEntitlementRequest } from "./dto/validate-entitlement.dto";

@Controller("internal/v1/entitlements")
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /**
   * Finance presents CONTROL_PLANE_SERVICE_TOKEN; industry satellites (via
   * satellite-kit) present SATELLITE_EVENT_SERVICE_TOKEN — same set as the snapshot route.
   */
  @Post("validate")
  validate(
    @Body() body: ValidateEntitlementRequest,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    return this.entitlements.validate(body);
  }
}
