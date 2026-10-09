import { Body, Controller, Headers, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { EntitlementsService } from "./entitlements.service";
import type { ValidateEntitlementRequest } from "./dto/validate-entitlement.dto";

/**
 * Service-token route, same as `internal/v1/subscription/snapshot`.
 * `@Public()` skips the user JWT guard: satellites send a service bearer,
 * which that guard would reject as an invalid user token (401) before
 * `assertMatchingServiceToken` runs.
 */
@Public()
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
