import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuditPiiKey, redactAuditChanges } from "./satellite-audit";

describe("satellite-audit redaction", () => {
  it("flags ADR PII key families", () => {
    assert.equal(isAuditPiiKey("password"), true);
    assert.equal(isAuditPiiKey("guestEmail"), true);
    assert.equal(isAuditPiiKey("IBAN"), true);
    assert.equal(isAuditPiiKey("account_number"), true);
    assert.equal(isAuditPiiKey("pin"), true);
    assert.equal(isAuditPiiKey("amount"), false);
  });

  it("redactAuditChanges masks nested secrets", () => {
    const out = redactAuditChanges({
      password: "x",
      nested: { fin: "7CHARXX", ok: 1 },
    }) as Record<string, unknown>;
    assert.equal(out.password, "[redacted]");
    assert.equal((out.nested as Record<string, unknown>).fin, "[redacted]");
    assert.equal((out.nested as Record<string, unknown>).ok, 1);
  });
});
