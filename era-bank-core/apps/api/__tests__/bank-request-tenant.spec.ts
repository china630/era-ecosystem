import {
  isBankRequestTenantExempt,
  parseBankRequestOrganizationId,
} from "../src/common/parse-bank-request-org";

describe("parseBankRequestOrganizationId", () => {
  it("reads X-Organization-Id", () => {
    expect(
      parseBankRequestOrganizationId({ "x-organization-id": " org-a " }),
    ).toBe("org-a");
  });

  it("reads x-era-organization-id", () => {
    expect(
      parseBankRequestOrganizationId({ "x-era-organization-id": "org-b" }),
    ).toBe("org-b");
  });

  it("ignores empty", () => {
    expect(parseBankRequestOrganizationId({})).toBeUndefined();
  });
});

describe("isBankRequestTenantExempt", () => {
  it("exempts health and internal Sync", () => {
    expect(isBankRequestTenantExempt("/api/health")).toBe(true);
    expect(isBankRequestTenantExempt("/api/internal/v1/runtime-config")).toBe(true);
    expect(isBankRequestTenantExempt("/api/v1/cif")).toBe(false);
  });
});
