import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fiscalize, resolveFiscalProviderName } from "../index";

describe("@era/fiscal", () => {
  it("defaults to mock provider", () => {
    assert.equal(resolveFiscalProviderName({ ERA_FISCAL_PROVIDER: "mock" }), "mock");
    assert.equal(resolveFiscalProviderName({ KKM_DRIVER: "nbc" }), "nbc");
  });

  it("fiscalize returns receiptId and driver", async () => {
    const r = await fiscalize(
      { documentRef: "test-1", amount: 10, paymentMethod: "CASH" },
      { ERA_FISCAL_PROVIDER: "mock" },
    );
    assert.ok(r.receiptId.startsWith("KKM-"));
    assert.equal(r.driver, "mock");
  });
});
