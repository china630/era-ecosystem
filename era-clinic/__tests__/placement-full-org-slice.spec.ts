/**
 * Clinic full-org placement slice isolation (DMMF delegates mocked).
 */
jest.mock("@era/satellite-kit", () => {
  const base = jest.requireActual("./mocks/satellite-kit") as Record<
    string,
    unknown
  >;
  const patients = [
    {
      id: "p-a",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      displayName: "Alice",
    },
    {
      id: "p-b",
      organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      displayName: "Bob",
    },
  ];
  return {
    ...base,
    buildDelegatesFromPrismaClient: () => ({
      modelOrder: ["PatientRef"],
      models: {
        PatientRef: {
          findMany: async ({
            where,
          }: {
            where: { organizationId: string };
          }) =>
            patients.filter((p) => p.organizationId === where.organizationId),
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

import {
  exportClinicOrgSlice,
  importClinicOrgSlice,
} from "@/lib/placement-slice.service";
import { ORG_FULL_SLICE_FORMAT_VERSION } from "@era/satellite-kit";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("clinic full-org placement slice", () => {
  it("exportClinicOrgSlice excludes other org patients", async () => {
    const slice = await exportClinicOrgSlice(ORG_A);
    expect(slice.formatVersion).toBe(ORG_FULL_SLICE_FORMAT_VERSION);
    expect(slice.note).toMatch(/full org slice v2/);
    expect(slice.rows.PatientRef).toHaveLength(1);
    expect(slice.rows.PatientRef[0].id).toBe("p-a");
  });

  it("import validate rejects org mismatch", async () => {
    const slice = await exportClinicOrgSlice(ORG_A);
    const result = await importClinicOrgSlice({
      organizationId: ORG_B,
      slice,
      mode: "validate",
    });
    expect(result.ok).toBe(false);
  });
});
