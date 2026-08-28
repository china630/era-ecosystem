/**
 * SaaS Wave 4 — hotel recurring cron response shape (kit mocked).
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
}));

jest.mock("@/lib/hotel-module-gate", () => ({
  requireHotelModule: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    recurringServiceSchedule: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/service-work-order.service", () => ({
  runDueRecurringSchedules: jest.fn(async () => [{ id: "wo-1" }]),
}));

import { runCronForEachTenant } from "@era/satellite-kit";
import { PUT } from "../app/api/service/recurring/route";

describe("saas wave 4 hotel recurring cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("PUT returns byOrganization from gate.results", async () => {
    (runCronForEachTenant as jest.Mock).mockImplementation(
      async (_opts: unknown, work: (id: string) => Promise<unknown>) => {
        const a = await work("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        const b = await work("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        return { ok: true, results: [a, b] };
      },
    );

    const res = await PUT(
      new Request("http://localhost/api/service/recurring", {
        method: "PUT",
        headers: { authorization: "Bearer test" },
      }),
    );
    const body = await res.json();
    expect(body.byOrganization).toHaveLength(2);
    expect(body.byOrganization[0].organizationId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(body.byOrganization[0].generated).toBe(1);
    expect(body.byOrganization[1].organizationId).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });

  it("PUT returns 401 when gate unauthorized", async () => {
    (runCronForEachTenant as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      reason: "unauthorized",
    });
    const res = await PUT(
      new Request("http://localhost/api/service/recurring", { method: "PUT" }),
    );
    expect(res.status).toBe(401);
  });
});
