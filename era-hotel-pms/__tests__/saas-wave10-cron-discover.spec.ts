/**
 * SaaS Wave 10 — hotel cron wires DB org discover callback.
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
}));

jest.mock("@/lib/cron-organization-ids", () => ({
  listCronOrganizationIdsFromDb: jest.fn(async () => [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ]),
}));

jest.mock("@/lib/services/auto-bar-engine.service", () => ({
  applyAutoBar: jest.fn(async () => ({ updated: 0 })),
}));

import { runCronForEachTenant } from "@era/satellite-kit";
import { listCronOrganizationIdsFromDb } from "@/lib/cron-organization-ids";
import { POST } from "../app/api/cron/auto-bar/route";

describe("saas wave 10 hotel cron discover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST passes listOrganizationIds to runCronForEachTenant", async () => {
    (runCronForEachTenant as jest.Mock).mockImplementation(
      async (
        opts: { listOrganizationIds?: () => Promise<string[]> },
        work: (id: string) => Promise<unknown>,
      ) => {
        expect(opts.listOrganizationIds).toBe(listCronOrganizationIdsFromDb);
        const ids = await opts.listOrganizationIds!();
        const results = [];
        for (const id of ids) {
          results.push(await work(id));
        }
        return { ok: true, results };
      },
    );

    const res = await POST(
      new Request("http://localhost/api/cron/auto-bar", {
        method: "POST",
        headers: { authorization: "Bearer test" },
      }),
    );
    const body = await res.json();
    expect(body.byOrganization).toHaveLength(2);
    expect(body.byOrganization[0].organizationId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(listCronOrganizationIdsFromDb).toHaveBeenCalled();
  });
});
