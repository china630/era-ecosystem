import {
  akbMode,
  asanMode,
  assertLiveConfigured,
  cardsMode,
  cbarMode,
  ConfigError,
  railMode,
} from "../src/integration/live-mode";
import { createCreditBureauAdapter } from "../src/modules/loans/bureau.adapter";
import { StubRailAdapter } from "../src/modules/payments/stub-rail.adapter";
import { MockAzeriCardGateway } from "../src/modules/cards/gateway/mock-azericard.gateway";
import { AsanSimaStubAdapter } from "../src/integration/asan-sima-stub.adapter";
import { PaymentRail } from "@era/bank-core-database";

describe("YC-E mode flags", () => {
  const baseEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...baseEnv };
  });

  it("defaults all modes to stub", () => {
    delete process.env.BANK_RAIL_MODE;
    delete process.env.BANK_CARDS_MODE;
    delete process.env.BANK_ASAN_MODE;
    delete process.env.BANK_BUREAU_MODE;
    delete process.env.BANK_CBAR_MODE;
    expect(railMode()).toBe("stub");
    expect(cardsMode()).toBe("stub");
    expect(asanMode()).toBe("stub");
    expect(akbMode()).toBe("stub");
    expect(cbarMode()).toBe("stub");
  });

  it("assertLiveConfigured throws ConfigError when creds missing", () => {
    expect(() =>
      assertLiveConfigured("live", { FOO: undefined }, "test"),
    ).toThrow(ConfigError);
  });

  it("createCreditBureauAdapter returns stub by default", () => {
    process.env.BANK_BUREAU_MODE = "stub";
    const adapter = createCreditBureauAdapter();
    expect(adapter).toBeDefined();
  });

  it("createCreditBureauAdapter fail-closed on live without creds", () => {
    process.env.BANK_BUREAU_MODE = "live";
    delete process.env.BANK_AKB_BASE_URL;
    delete process.env.BANK_AKB_API_KEY;
    expect(() => createCreditBureauAdapter()).toThrow(ConfigError);
  });

  it("StubRailAdapter fail-closed on live without creds", async () => {
    process.env.BANK_RAIL_MODE = "live";
    delete process.env.BANK_RAIL_BASE_URL;
    delete process.env.BANK_RAIL_API_KEY;
    const rail = new StubRailAdapter();
    await expect(
      rail.submit({
        id: "po-1",
        rail: PaymentRail.AZIPS,
      } as never),
    ).rejects.toThrow(ConfigError);
  });

  it("MockAzeriCardGateway fail-closed on live without creds", () => {
    process.env.BANK_CARDS_MODE = "live";
    delete process.env.BANK_CARDS_BASE_URL;
    delete process.env.BANK_CARDS_API_KEY;
    const gw = new MockAzeriCardGateway();
    expect(() =>
      gw.forwardAuthorize({ amountMinor: "100" }),
    ).toThrow(ConfigError);
  });

  it("AsanSimaStubAdapter fail-closed on live without creds", () => {
    process.env.BANK_ASAN_MODE = "live";
    delete process.env.BANK_ASAN_BASE_URL;
    delete process.env.BANK_ASAN_API_KEY;
    const asan = new AsanSimaStubAdapter();
    expect(() =>
      asan.startChallenge({ identifier: "ABC1234" }),
    ).toThrow(ConfigError);
  });
});
