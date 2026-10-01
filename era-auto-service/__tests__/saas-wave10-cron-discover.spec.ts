/**
 * SaaS Wave 10 — auto cron passes only the orch pool registry to the kit.
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
}));

jest.mock("@/lib/cron-organization-ids", () => ({
  fetchAutoPoolOrganizationIds: jest.fn(async () => [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ]),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    workOrder: {
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock("@/lib/platform-notify", () => ({
  platformNotificationsEnabled: () => false,
}));

jest.mock("@/lib/production-calendar", () => ({
  nextServiceAppointmentDay: jest.fn(),
}));

jest.mock("@/integration/control-plane-platform.client", () => ({
  sendNotification: jest.fn(),
  createBookingSlots: jest.fn(),
}));

import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchAutoPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { POST } from "../app/api/cron/service-due/route";

describe("saas wave 10 auto cron discover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST passes only fetchPoolOrganizationIds to runCronForEachTenant", async () => {
    (runCronForEachTenant as jest.Mock).mockImplementation(
      async (
        opts: Record<string, unknown> & { fetchPoolOrganizationIds?: () => Promise<string[]> },
        work: (id: string) => Promise<unknown>,
      ) => {
        expect(opts.fetchPoolOrganizationIds).toBe(fetchAutoPoolOrganizationIds);
        expect(opts).not.toHaveProperty("listOrganizationIds");
        const ids = await opts.fetchPoolOrganizationIds!();
        const results = [];
        for (const id of ids) {
          results.push(await work(id));
        }
        return { ok: true, results };
      },
    );

    const res = await POST(
      new Request("http://localhost/api/cron/service-due", {
        method: "POST",
        headers: { authorization: "Bearer test" },
      }),
    );
    const body = await res.json();
    expect(body.byOrganization).toHaveLength(2);
    expect(fetchAutoPoolOrganizationIds).toHaveBeenCalled();
  });

  it("POST surfaces the kit 503 reason when the org list is unavailable", async () => {
    (runCronForEachTenant as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      reason: "pool_registry_empty",
    });
    const res = await POST(
      new Request("http://localhost/api/cron/service-due", { method: "POST" }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "pool_registry_empty" });
  });
});
