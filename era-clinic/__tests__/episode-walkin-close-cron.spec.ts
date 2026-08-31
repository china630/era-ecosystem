/**
 * CLI-55 — episode-walkin-close cron discovers orgs like other clinic crons.
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
}));

jest.mock("@/lib/cron-organization-ids", () => ({
  listCronOrganizationIdsFromDb: jest.fn(async () => [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ]),
  fetchClinicPoolOrganizationIds: jest.fn(async () => []),
}));

jest.mock("@/lib/services/sanatorium.service", () => ({
  closeIdleWalkInEpisodes: jest.fn(async () => ({ closed: 1, skipped: 0 })),
}));

import { runCronForEachTenant } from "@era/satellite-kit";
import { listCronOrganizationIdsFromDb } from "@/lib/cron-organization-ids";
import { POST } from "../app/api/cron/episode-walkin-close/route";

describe("CLI-55 episode-walkin-close cron", () => {
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
      new Request("http://localhost/api/cron/episode-walkin-close", {
        method: "POST",
        headers: { authorization: "Bearer test" },
      }),
    );
    const body = await res.json();
    expect(body.byOrganization).toHaveLength(1);
    expect(body.byOrganization[0]).toMatchObject({
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      closed: 1,
    });
  });
});
