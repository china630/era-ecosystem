import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearLoginOrgNoCacheForTests,
  lookupLoginOrgNo,
} from "../auth/resolve-login-org";
import {
  hydrateLoginOrgNoMapFromDisk,
  mergeLoginOrgNoPersistent,
  pruneLoginOrgNoPersistent,
} from "./login-org-no-persist";

describe("login-org-no-persist A4 merge", () => {
  let dir: string;
  let prev: string | undefined;

  beforeEach(() => {
    clearLoginOrgNoCacheForTests();
    dir = mkdtempSync(join(tmpdir(), "era-orgno-"));
    prev = process.env.ERA_ORG_PUBLIC_NUMBERS_FILE;
    process.env.ERA_ORG_PUBLIC_NUMBERS_FILE = join(dir, "map.json");
  });

  afterEach(() => {
    clearLoginOrgNoCacheForTests();
    if (prev === undefined) delete process.env.ERA_ORG_PUBLIC_NUMBERS_FILE;
    else process.env.ERA_ORG_PUBLIC_NUMBERS_FILE = prev;
    rmSync(dir, { recursive: true, force: true });
  });

  it("two sequential upserts keep both org mappings", () => {
    mergeLoginOrgNoPersistent(104221, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    mergeLoginOrgNoPersistent(204222, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    clearLoginOrgNoCacheForTests();
    hydrateLoginOrgNoMapFromDisk();
    assert.equal(
      lookupLoginOrgNo(104221),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    assert.equal(
      lookupLoginOrgNo(204222),
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });

  it("prune drops all numbers for one organization", () => {
    mergeLoginOrgNoPersistent(104221, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    mergeLoginOrgNoPersistent(204222, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    pruneLoginOrgNoPersistent("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    clearLoginOrgNoCacheForTests();
    hydrateLoginOrgNoMapFromDisk();
    assert.equal(lookupLoginOrgNo(104221), undefined);
    assert.equal(
      lookupLoginOrgNo(204222),
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });
});
