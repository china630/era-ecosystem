import { PaymentRail } from "@era/bank-core-database";
import { AzipsRailAdapter } from "../src/modules/payments/azips.adapter";
import { XohksRailAdapter } from "../src/modules/payments/xohks.adapter";
import { AosRailAdapter } from "../src/modules/payments/aos.adapter";
import { SwiftRailAdapter } from "../src/modules/payments/swift.adapter";
import { InternalRailAdapter } from "../src/modules/payments/internal-rail.adapter";
import { StubRailAdapter } from "../src/modules/payments/stub-rail.adapter";
import { PaymentRailAdapterFactory } from "../src/modules/payments/rail-adapter.factory";

describe("PaymentRailAdapterFactory", () => {
  const factory = new PaymentRailAdapterFactory(
    new AzipsRailAdapter(),
    new XohksRailAdapter(),
    new AosRailAdapter(),
    new SwiftRailAdapter(),
    new InternalRailAdapter(),
    new StubRailAdapter(),
  );

  it.each([
    [PaymentRail.AZIPS, "AzipsRailAdapter", PaymentRail.AZIPS],
    [PaymentRail.XOHKS, "XohksRailAdapter", PaymentRail.XOHKS],
    [PaymentRail.AOS, "AosRailAdapter", PaymentRail.AOS],
    [PaymentRail.SWIFT, "SwiftRailAdapter", PaymentRail.SWIFT],
    [PaymentRail.INTERNAL, "InternalRailAdapter", PaymentRail.INTERNAL],
  ] as const)("resolves %s to %s", (rail, className, expectedRail) => {
    const adapter = factory.resolve(rail);
    expect(adapter.constructor.name).toBe(className);
    expect(adapter.rail).toBe(expectedRail);
  });

  it("falls back to StubRailAdapter for unknown rail enum value", () => {
    const adapter = factory.resolve("UNKNOWN_RAIL" as PaymentRail);
    expect(adapter).toBeInstanceOf(StubRailAdapter);
  });
});