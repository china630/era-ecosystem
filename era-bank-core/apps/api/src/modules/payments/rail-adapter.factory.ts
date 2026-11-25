import { Injectable } from "@nestjs/common";
import { PaymentRail } from "@era/bank-core-database";
import type { PaymentRailAdapter } from "./payment-rail.adapter";
import { AzipsRailAdapter } from "./azips.adapter";
import { XohksRailAdapter } from "./xohks.adapter";
import { AosRailAdapter } from "./aos.adapter";
import { SwiftRailAdapter } from "./swift.adapter";
import { InternalRailAdapter } from "./internal-rail.adapter";
import { StubRailAdapter } from "./stub-rail.adapter";

@Injectable()
export class PaymentRailAdapterFactory {
  constructor(
    private readonly azips: AzipsRailAdapter,
    private readonly xohks: XohksRailAdapter,
    private readonly aos: AosRailAdapter,
    private readonly swift: SwiftRailAdapter,
    private readonly internalRail: InternalRailAdapter,
    private readonly stubRail: StubRailAdapter,
  ) {}

  resolve(rail: PaymentRail): PaymentRailAdapter {
    switch (rail) {
      case PaymentRail.INTERNAL:
        return this.internalRail;
      case PaymentRail.AZIPS:
        return this.azips;
      case PaymentRail.XOHKS:
        return this.xohks;
      case PaymentRail.AOS:
        return this.aos;
      case PaymentRail.SWIFT:
        return this.swift;
      default:
        return this.stubRail;
    }
  }
}