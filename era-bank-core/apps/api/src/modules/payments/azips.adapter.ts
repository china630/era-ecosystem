import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";
import { submitExternalRailStub } from "./rail-stub.submit";

/** AZIPS (CBA retail clearing) — ISO 20022 pacs.008 scaffold. */
@Injectable()
export class AzipsRailAdapter implements PaymentRailAdapter {
  readonly rail = PaymentRail.AZIPS;

  submit(order: PaymentOrder): Promise<RailSubmitResult> {
    return submitExternalRailStub(order, PaymentRail.AZIPS, "pacs.008 azips stub");
  }
}