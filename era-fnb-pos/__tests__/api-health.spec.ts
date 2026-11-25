jest.mock("@era/satellite-kit", () => ({
  runWithSatelliteTenant: async (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
}));
jest.mock("../nest/bridge", () => ({
  enterFnbStaff: async () => true,
  fnbNestSession: async () => null,
  runWithFnbTenant: async (_session: unknown, fn: () => Promise<unknown>) => fn(),
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

import { HealthController } from "../nest/native/controllers/health";

describe("GET /api/health", () => {
  it("returns ok payload", async () => {
    const controller = new HealthController();
    let statusCode = 200;
    let payload: unknown;
    const httpRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: unknown) {
        payload = data;
        return this;
      },
      send(data: unknown) {
        payload = data;
        return this;
      },
      setHeader() {
        return this;
      },
    };
    await controller.get_0(
      { headers: {}, get: () => undefined } as never,
      httpRes as never,
    );
    expect(statusCode).toBe(200);
    const body = payload as { ok?: boolean; service?: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.service).toBe("string");
  });
});
