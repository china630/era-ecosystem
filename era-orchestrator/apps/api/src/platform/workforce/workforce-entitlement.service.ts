import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { SubscriptionAccessService } from "../../subscription/subscription-access.service";

const WORKFORCE_MODULE = "platform_workforce";

@Injectable()
export class WorkforceEntitlementService {
  constructor(
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async assertWorkforceHub(organizationId: string): Promise<void> {
    if (await this.subscriptionAccess.hasModule(organizationId, WORKFORCE_MODULE)) {
      return;
    }
    throw new ForbiddenException({
      code: "PLATFORM_WORKFORCE_REQUIRED",
      message: "Workforce hub is not entitled for this organization.",
    });
  }

  async hasWorkforceHub(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(organizationId, WORKFORCE_MODULE);
  }
}
