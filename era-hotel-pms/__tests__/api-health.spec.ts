import { invokeNest } from "./nest-invoke";
import { register } from "../nest/generated/health";

describe("GET /api/health", () => {
  it("returns ok payload", async () => {
    const res = await invokeNest(register, "get", "/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.service).toBe("string");
  });
});
