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
