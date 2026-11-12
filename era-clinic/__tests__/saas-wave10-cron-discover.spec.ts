/**
 * SaaS Wave 10 — clinic cron passes only the orch pool registry to the kit.
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
}));

jest.mock("@/lib/cron-organization-ids", () => ({
  fetchClinicPoolOrganizationIds: jest.fn(async () => [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ]),
}));

jest.mock("@/domain/procedure/procedure-completion.service", () => ({
  autoCompleteElapsedCheckedIn: jest.fn(async () => ({ completed: 0 })),
}));

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

import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { register } from "../nest/generated/cron_procedure-auto-complete";

async function postCron(): Promise<{ status: number; body: { byOrganization?: unknown[]; error?: string } }> {
  let captured: { status: number; body: { byOrganization?: unknown[]; error?: string } } | undefined;
  let pending = Promise.resolve();
  register({
    post(_path: string, handler: (req: unknown, res: unknown) => Promise<void>) {
      const res = {
        status(code: number) {
          return {
            json(body: { byOrganization?: unknown[]; error?: string }) {
              captured = { status: code, body };
            },
          };
        },
      };
      const req = {
        method: "POST",
        url: "/api/cron/procedure-auto-complete",
        originalUrl: "/api/cron/procedure-auto-complete",
        headers: { authorization: "Bearer test" },
        get(name: string) {
          return req.headers[name.toLowerCase() as "authorization"] ?? null;
        },
      };
      pending = Promise.resolve(handler(req, res));
    },
    get() {},
    put() {},
    patch() {},
    delete() {},
  });
  await pending;
  if (!captured) throw new Error("cron handler did not respond");
  return captured;
}

describe("saas wave 10 clinic cron discover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST passes only fetchPoolOrganizationIds to runCronForEachTenant", async () => {
    (runCronForEachTenant as jest.Mock).mockImplementation(
      async (
        opts: Record<string, unknown> & { fetchPoolOrganizationIds?: () => Promise<string[]> },
        work: (id: string) => Promise<unknown>,
      ) => {
        expect(opts.fetchPoolOrganizationIds).toBe(fetchClinicPoolOrganizationIds);
        expect(opts).not.toHaveProperty("listOrganizationIds");
        const ids = await opts.fetchPoolOrganizationIds!();
        const results = [];
        for (const id of ids) {
          results.push(await work(id));
        }
        return { ok: true, results };
      },
    );

    const res = await postCron();
    const body = res.body;
    expect(body.byOrganization).toHaveLength(2);
    expect(body.byOrganization[0].organizationId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(fetchClinicPoolOrganizationIds).toHaveBeenCalled();
  });

  it("POST surfaces the kit 503 reason when the org list is unavailable", async () => {
    (runCronForEachTenant as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      reason: "pool_registry_empty",
    });
    const res = await postCron();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "pool_registry_empty" });
  });
});
