import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Stub bridge: CP subscription invoice → operator Finance AR (ADR operator-finance-dogfood).
 * Full consumer will map PLATFORM_INVOICE_ISSUED idempotently by invoice id.
 */
@Injectable()
export class OperatorFinanceBridgeService {
  private readonly log = new Logger(OperatorFinanceBridgeService.name);

  constructor(private readonly config: ConfigService) {}

  async onPlatformInvoiceIssued(subscriptionInvoiceId: string): Promise<void> {
    const operatorOrgId = this.config.get<string>("ERA_OPERATOR_ORGANIZATION_ID");
    if (!operatorOrgId?.trim()) {
      this.log.debug(
        "ERA_OPERATOR_ORGANIZATION_ID unset — skip operator Finance bridge",
      );
      return;
    }
    this.log.log(
      `PLATFORM_INVOICE_ISSUED stub invoiceId=${subscriptionInvoiceId} operatorOrgId=${operatorOrgId}`,
    );
  }
}
