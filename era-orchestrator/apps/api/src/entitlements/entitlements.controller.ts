import { Body, Controller, Headers, Post } from "@nestjs/common";
import { assertInternalServiceToken } from "../common/utils/internal-service-token.util";
import { EntitlementsService } from "./entitlements.service";
import type { ValidateEntitlementRequest } from "./dto/validate-entitlement.dto";

@Controller("internal/v1/entitlements")
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Post("validate")
  validate(
    @Body() body: ValidateEntitlementRequest,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertInternalServiceToken(
      auth,
      "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
      xToken,
    );
    return this.entitlements.validate(body);
  }
}
