/**
 * SaaS Wave 4 — auto service-due multi-org cron (kit mocked).
 */
jest.mock("@era/satellite-kit", () => ({
  runCronForEachTenant: jest.fn(),
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
import { POST } from "../app/api/cron/service-due/route";

describe("saas wave 4 auto service-due cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST returns byOrganization from gate.results", async () => {
    (runCronForEachTenant as jest.Mock).mockImplementation(
      async (_opts: unknown, work: (id: string) => Promise<unknown>) => {
        const a = await work("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        const b = await work("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        return { ok: true, results: [a, b] };
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
    expect(body.byOrganization[0].organizationId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(body.byOrganization[0].skipped).toBe("platform_env_unset");
    expect(body.byOrganization[1].organizationId).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });
});
