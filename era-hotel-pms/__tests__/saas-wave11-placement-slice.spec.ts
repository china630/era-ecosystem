/**
 * SaaS Wave 11 — hotel placement slice export isolation (prisma mocked).
 */
jest.mock("@era/satellite-kit", () => {
  const actual = jest.requireActual("@era/satellite-kit");
  return {
    ...actual,
  };
});

jest.mock("@/lib/prisma", () => {
  const guests = [
    {
      id: "g-a",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fullName: "Alice",
    },
    {
      id: "g-b",
      organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      fullName: "Bob",
    },
  ];
  const empty = async () => [];
  return {
    prisma: {
      role: { findMany: empty, create: jest.fn(), deleteMany: jest.fn() },
      user: { findMany: empty, create: jest.fn(), deleteMany: jest.fn() },
      guest: {
        findMany: jest.fn(
          async ({ where }: { where: { organizationId: string } }) =>
            guests.filter((g) => g.organizationId === where.organizationId),
        ),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    },
  };
});

import { exportHotelOrgSlice, importHotelOrgSlice } from "@/lib/placement-slice.service";
import { POST as exportPost } from "../app/api/internal/v1/placement/export-slice/route";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("saas wave 11 hotel placement slice", () => {
  beforeEach(() => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "test-token";
  });

  it("exportHotelOrgSlice excludes other org guests", async () => {
    const slice = await exportHotelOrgSlice(ORG_A);
    expect(slice.note).toMatch(/hotel curated json slice v1/);
    expect(slice.note).not.toMatch(/not implemented/);
    expect(slice.rows.guest).toHaveLength(1);
    expect(slice.rows.guest[0].id).toBe("g-a");
  });

  it("import validate rejects org mismatch", async () => {
    const slice = await exportHotelOrgSlice(ORG_A);
    const result = await importHotelOrgSlice({
      organizationId: ORG_B,
      slice,
      mode: "validate",
    });
    expect(result.ok).toBe(false);
  });

  it("POST export-slice returns summary with rowCounts", async () => {
    const res = await exportPost(
      new Request("http://localhost/api/internal/v1/placement/export-slice", {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ organizationId: ORG_A, includeRows: false }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rowCounts.guest).toBe(1);
    expect(body.note).toMatch(/hotel curated json slice v1/);
    expect(body.rows).toBeUndefined();
  });
});
