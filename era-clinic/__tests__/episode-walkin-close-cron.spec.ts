/**
 * CLI-55 — episode-walkin-close cron lists orgs like other clinic crons (orch pool registry).
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
}));

jest.mock("@/lib/cron-organization-ids", () => ({
  fetchClinicPoolOrganizationIds: jest.fn(async () => [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ]),
}));

jest.mock("@/lib/services/sanatorium.service", () => ({
  closeIdleWalkInEpisodes: jest.fn(async () => ({ closed: 1, skipped: 0 })),
}));

jest.mock("../nest/bridge", () => ({
  nestHeader: (req: { get?: (name: string) => string | null }, name: string) =>
    req.get?.(name) ?? null,
  withClinicHttp: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  runWithStaffTenantIfPresent: async (_req: unknown, fn: () => Promise<unknown>) => fn(),
  sendRouteError: jest.fn(),
  sendWebResponse: jest.fn(),
}));

import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { CronEpisodeWalkinCloseController } from "../nest/native/controllers/cron_episode-walkin-close.controller";

describe("CLI-55 episode-walkin-close cron", () => {
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

    const ctrl = new CronEpisodeWalkinCloseController();
    const req = {
      method: "POST",
      url: "/api/cron/episode-walkin-close",
      originalUrl: "/api/cron/episode-walkin-close",
      headers: { authorization: "Bearer test" },
      get(name: string) {
        return (this.headers as Record<string, string>)[name.toLowerCase()] ?? null;
      },
    };
    const body = (await ctrl.post_0(req as never)) as {
      byOrganization?: Array<Record<string, unknown>>;
    };
    expect(body.byOrganization).toHaveLength(1);
    expect(body.byOrganization![0]).toMatchObject({
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      closed: 1,
    });
  });
});
