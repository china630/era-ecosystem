import "reflect-metadata";
import { HealthController } from "../nest/native/controllers/health.controller";

describe("GET /api/health", () => {
  it("returns ok payload from Nest HealthController", () => {
    const body = new HealthController().health();
    expect(body.ok).toBe(true);
    expect(typeof body.service).toBe("string");
  });
});
