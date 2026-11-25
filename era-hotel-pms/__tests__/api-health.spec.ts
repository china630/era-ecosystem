import { invokeMethod } from "./nest-invoke";
import { HealthController } from "../nest/native/controllers/health";

describe("GET /api/health", () => {
  it("returns ok payload", async () => {
    const controller = new HealthController();
    const res = await invokeMethod(controller.get_0.bind(controller));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.service).toBe("string");
  });
});
