/**
 * SaaS Wave 11 — hotel full-org placement slice isolation (DMMF delegates mocked).
 */
jest.mock("@era/satellite-kit", () => {
  const base = jest.requireActual("./mocks/satellite-kit") as Record<
    string,
    unknown
  >;
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
  return {
    ...base,
    buildDelegatesFromPrismaClient: () => ({
      modelOrder: ["Guest"],
      models: {
        Guest: {
          findMany: async ({
            where,
          }: {
            where: { organizationId: string };
          }) => guests.filter((g) => g.organizationId === where.organizationId),
          create: jest.fn(),
          deleteMany: jest.fn(),
        },
      },
    }),
  };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { exportHotelOrgSlice, importHotelOrgSlice } from "@/lib/placement-slice.service";
import { register as registerExport } from "../nest/generated/internal_v1_placement_export-slice";
import { ORG_FULL_SLICE_FORMAT_VERSION } from "@era/satellite-kit";
import { invokeNest } from "./nest-invoke";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("saas wave 11 hotel placement slice", () => {
  beforeEach(() => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "test-token";
  });

  it("exportHotelOrgSlice excludes other org guests", async () => {
    const slice = await exportHotelOrgSlice(ORG_A);
    expect(slice.formatVersion).toBe(ORG_FULL_SLICE_FORMAT_VERSION);
    expect(slice.note).toMatch(/full org slice v2/);
    expect(slice.note).not.toMatch(/not implemented/);
    expect(slice.rows.Guest).toHaveLength(1);
    expect(slice.rows.Guest[0].id).toBe("g-a");
    expect(slice.objectStorage.stub).toBe(true);
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
    const res = await invokeNest(registerExport, "post", "/api/internal/v1/placement/export-slice", {
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: { organizationId: ORG_A, includeRows: false },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.formatVersion).toBe(ORG_FULL_SLICE_FORMAT_VERSION);
    expect(body.rowCounts.Guest).toBe(1);
    expect(body.note).toMatch(/full org slice v2/);
    expect(body.rows).toBeUndefined();
    expect(body.checksum).toEqual(expect.any(String));
  });
});
