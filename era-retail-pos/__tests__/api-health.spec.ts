jest.mock("@era/satellite-kit", () => ({
  runWithSatelliteTenant: async (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
}));
jest.mock("../nest/bridge", () => ({
  enterRetailStaff: async () => true,
  retailNestSession: async () => null,
  runWithRetailTenant: async (_session: unknown, fn: () => Promise<unknown>) => fn(),
  runWithNestHttp: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  runWithStaffTenantIfPresent: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  nestHeader: () => null,
  nestQuery: () => new URLSearchParams(),
  readNestForm: async () => new FormData(),
  rejectMissingAgency: () => undefined,
  sendBytes: () => undefined,
  sendWebResponse: async () => undefined,
  sendJson: (res: { status: (code: number) => { json: (data: unknown) => void } }, data: unknown, status = 200) => {
    res.status(status).json(data);
  },
  sendRouteError: async (res: { status: (code: number) => { json: (data: unknown) => void } }, err: unknown) => {
    const message = err instanceof Error ? err.message : "error";
    res.status(500).json({ error: message });
  },
}));

import { invokeMethod } from "./nest-invoke";
import { HealthController } from "../nest/native/controllers/health";

describe("GET /api/health", () => {
  it("returns ok payload", async () => {
    const controller = new HealthController();
    const res = await invokeMethod((req, httpRes) => controller.get_0(req as never, httpRes as never));
    if (!res.json) throw new Error("missing");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.service).toBe("string");
  });
});
