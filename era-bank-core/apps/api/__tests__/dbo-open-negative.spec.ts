import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DboOpenApiService } from "../src/modules/dbo/dbo-open-api.service";
import { hashApiKey } from "../src/modules/dbo/dbo-crypto.util";

function service(): DboOpenApiService {
  const config = { get: () => undefined } as unknown as ConfigService;
  return new DboOpenApiService(config);
}

describe("AC-DBO-OPEN negatives", () => {
  it("missing X-Api-Key → 401", () => {
    const svc = service();
    expect(() => svc.authenticate(undefined)).toThrow(UnauthorizedException);
  });

  it("unknown key → 401", () => {
    const svc = service();
    expect(() => svc.authenticate("not-a-real-key")).toThrow(UnauthorizedException);
  });

  it("revoked key → 401", () => {
    const svc = service();
    const raw = "revoke-me-now";
    svc.registerKey({
      id: "k1",
      keyHash: hashApiKey(raw),
      customerId: "cust-a",
      organizationId: "org-a",
      permissions: ["accounts:read"],
    });
    svc.revokeKey("k1");
    expect(() => svc.authenticate(raw)).toThrow(UnauthorizedException);
  });

  it("key of org A does not authenticate as org B customer", () => {
    const svc = service();
    const rawA = "key-org-a";
    const rawB = "key-org-b";
    svc.registerKey({
      id: "ka",
      keyHash: hashApiKey(rawA),
      customerId: "cust-a",
      organizationId: "org-a",
      permissions: ["accounts:read"],
    });
    svc.registerKey({
      id: "kb",
      keyHash: hashApiKey(rawB),
      customerId: "cust-b",
      organizationId: "org-b",
      permissions: ["accounts:read"],
    });
    const a = svc.authenticate(rawA);
    expect(a.organizationId).toBe("org-a");
    expect(a.customerId).toBe("cust-a");
    expect(svc.authenticate(rawB).organizationId).toBe("org-b");
  });

  it("missing scope → 403", () => {
    const svc = service();
    const raw = "read-only-key";
    svc.registerKey({
      id: "k-ro",
      keyHash: hashApiKey(raw),
      customerId: "cust-a",
      permissions: ["accounts:read"],
    });
    const key = svc.authenticate(raw);
    expect(() => svc.assertPermission(key, "payments:create")).toThrow(ForbiddenException);
  });
});
