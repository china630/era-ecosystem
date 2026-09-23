import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("ui barrel stays browser-safe", () => {
  it("does not import Node password/scrypt via staff-login-org", () => {
    const barrel = readFileSync(join(__dirname, "index.js"), "utf8");
    assert.equal(
      barrel.includes("staff-login-org.js"),
      false,
      "ui/index must not import server staff-login-org (crypto.scrypt)",
    );
    assert.equal(barrel.includes("password.js"), false);
    assert.equal(barrel.includes("staff-login-org-storage"), true);
    assert.equal(
      barrel.includes("time/baku"),
      false,
      "ui/index must not import @era/satellite-kit/time (clients import the time subpath)",
    );
  });
});
