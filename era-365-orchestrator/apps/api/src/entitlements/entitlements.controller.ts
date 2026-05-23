import { Body, Controller, Post } from "@nestjs/common";
import { EntitlementsService } from "./entitlements.service";
import type { ValidateEntitlementRequest } from "./dto/validate-entitlement.dto";

@Controller("internal/v1/entitlements")
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Post("validate")
  validate(@Body() body: ValidateEntitlementRequest) {
    return this.entitlements.validate(body);
  }
}
