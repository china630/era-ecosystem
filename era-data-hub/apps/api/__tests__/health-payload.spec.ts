import { HEALTH_CHECK_PAYLOAD } from "../src/common/health-payload";

describe("HEALTH_CHECK_PAYLOAD", () => {
  it("exposes stable service identity for smoke checks", () => {
    expect(HEALTH_CHECK_PAYLOAD.status).toBe("ok");
    expect(HEALTH_CHECK_PAYLOAD.service).toBe("era-data-hub");
    expect(HEALTH_CHECK_PAYLOAD.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
