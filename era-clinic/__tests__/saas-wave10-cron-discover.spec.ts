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
  nestHeader: (req: { get?: (name: string) => string | null }, name: string) =>
    req.get?.(name) ?? null,
  withClinicHttp: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  runWithStaffTenantIfPresent: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  sendRouteError: jest.fn(),
  sendWebResponse: jest.fn(),
}));

import { HttpException } from "@nestjs/common";
import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { CronProcedureAutoCompleteController } from "../nest/native/controllers/cron_procedure-auto-complete.controller";

function mockReq() {
  return {
    method: "POST",
    url: "/api/cron/procedure-auto-complete",
    originalUrl: "/api/cron/procedure-auto-complete",
    headers: { authorization: "Bearer test" },
    get(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()] ?? null;
    },
  };
}

describe("saas wave 10 clinic cron discover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST passes only fetchPoolOrganizationIds to runCronForEachTenant", async () => {
    (runCronForEachTenant as jest.Mock).mockImplementation(
      async (
        opts: Record<string, unknown> & {
          fetchPoolOrganizationIds?: () => Promise<string[]>;
        },
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

    const ctrl = new CronProcedureAutoCompleteController();
    const body = (await ctrl.post_0(mockReq() as never)) as {
      byOrganization?: Array<{ organizationId?: string }>;
    };
    expect(body.byOrganization).toHaveLength(2);
    expect(body.byOrganization![0].organizationId).toBe(
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
    const ctrl = new CronProcedureAutoCompleteController();
    await expect(ctrl.post_0(mockReq() as never)).rejects.toBeInstanceOf(HttpException);
    try {
      await ctrl.post_0(mockReq() as never);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const ex = err as HttpException;
      expect(ex.getStatus()).toBe(503);
      expect(ex.getResponse()).toEqual({ error: "pool_registry_empty" });
    }
  });
});
