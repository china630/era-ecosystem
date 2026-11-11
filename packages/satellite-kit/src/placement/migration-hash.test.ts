import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fingerprintMigrationNames,
  migrationHashesMatch,
} from "./migration-hash";
import { diskPrecheckOk } from "./disk-precheck";

describe("migration-hash", () => {
  it("fingerprints sorted names stably", () => {
    const a = fingerprintMigrationNames(["b", "a"]);
    const b = fingerprintMigrationNames(["a", "b"]);
    assert.equal(a, b);
    assert.equal(a.length, 24);
  });

  it("match requires both sides", () => {
    assert.equal(migrationHashesMatch("abc", "abc"), true);
    assert.equal(migrationHashesMatch("abc", "xyz"), false);
    assert.equal(migrationHashesMatch("", "abc"), false);
  });
});

describe("disk-precheck", () => {
  it("fails when below min", () => {
    const r = diskPrecheckOk({ freeBytes: 100, minFreeBytes: 200 });
    assert.equal(r.ok, false);
  });

  it("passes when enough free", () => {
    const r = diskPrecheckOk({ freeBytes: 500, minFreeBytes: 200 });
    assert.equal(r.ok, true);
  });
});
