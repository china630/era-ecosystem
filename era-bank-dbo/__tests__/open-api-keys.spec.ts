import { isOpenApiPermission } from "../lib/open-api-permissions";

describe("AC-DBO-OPEN channel helpers", () => {
  it("rejects unknown permission strings", () => {
    expect(isOpenApiPermission("accounts:read")).toBe(true);
    expect(isOpenApiPermission("admin:*")).toBe(false);
  });
});
