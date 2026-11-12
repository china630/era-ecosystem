jest.mock("../nest/bridge", () => ({
  nestHeader: (req: { get?: (name: string) => string | null }, name: string) => req.get?.(name) ?? null,
  runWithNestHttp: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  runWithStaffTenantIfPresent: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  sendJson: (res: { status: (code: number) => { json: (body: unknown) => void } }, data: unknown, status = 200) => {
    res.status(status).json(data);
  },
  sendRouteError: jest.fn(),
  sendWebResponse: jest.fn(),
}));

import { register } from "../nest/generated/health";

function getHealth(): Promise<{ status: number; body: { ok?: boolean; service?: string } }> {
  return new Promise((resolve, reject) => {
    register({
      get(_path: string, handler: (req: unknown, res: unknown) => Promise<void>) {
        const res = {
          status(code: number) {
            return {
              json(body: { ok?: boolean; service?: string }) {
                resolve({ status: code, body });
              },
            };
          },
        };
        handler({ method: "GET", url: "/api/health", headers: {} }, res).catch(reject);
      },
      post() {},
      put() {},
      patch() {},
      delete() {},
    });
  });
}

describe("GET /api/health", () => {
  it("returns ok payload", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.service).toBe("string");
  });
});
