import {
  exportOrgSlice,
  importOrgSlice,
  type OrgSliceExportResult,
  type OrgSliceImportResult,
  type SliceModelDelegate,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { HOTEL_PLACEMENT_SLICE_MODEL_ORDER } from "@/lib/placement-slice-models";

function withSkipTenantFilter<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.ERA_SKIP_TENANT_FILTER;
  process.env.ERA_SKIP_TENANT_FILTER = "1";
  return fn().finally(() => {
    if (prev === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prev;
  });
}

function hotelSliceModels(): Record<string, SliceModelDelegate> {
  return {
    role: {
      findMany: (args) =>
        prisma.role.findMany({
          where: { organizationId: args.where.organizationId },
        }) as Promise<Record<string, unknown>[]>,
      create: ({ data }) => prisma.role.create({ data: data as never }),
      deleteMany: (args) =>
        prisma.role.deleteMany({
          where: { organizationId: args.where.organizationId },
        }),
    },
    user: {
      findMany: (args) =>
        prisma.user.findMany({
          where: { organizationId: args.where.organizationId },
        }) as Promise<Record<string, unknown>[]>,
      create: ({ data }) => prisma.user.create({ data: data as never }),
      deleteMany: (args) =>
        prisma.user.deleteMany({
          where: { organizationId: args.where.organizationId },
        }),
    },
    guest: {
      findMany: (args) =>
        prisma.guest.findMany({
          where: { organizationId: args.where.organizationId },
        }) as Promise<Record<string, unknown>[]>,
      create: ({ data }) => prisma.guest.create({ data: data as never }),
      deleteMany: (args) =>
        prisma.guest.deleteMany({
          where: { organizationId: args.where.organizationId },
        }),
    },
  };
}

export async function exportHotelOrgSlice(
  organizationId: string,
): Promise<OrgSliceExportResult> {
  return withSkipTenantFilter(() =>
    exportOrgSlice({
      organizationId,
      models: hotelSliceModels(),
    }),
  );
}

export async function importHotelOrgSlice(input: {
  organizationId: string;
  slice: OrgSliceExportResult;
  mode: "validate" | "upsert";
}): Promise<OrgSliceImportResult> {
  return withSkipTenantFilter(() =>
    importOrgSlice({
      organizationId: input.organizationId,
      slice: input.slice,
      mode: input.mode,
      modelOrder: [...HOTEL_PLACEMENT_SLICE_MODEL_ORDER],
      models: hotelSliceModels(),
    }),
  );
}

/** Summary for orch PlacementJob.sliceMeta (no full row payload). */
export function hotelSliceMetaSummary(slice: OrgSliceExportResult) {
  return {
    organizationId: slice.organizationId,
    formatVersion: slice.formatVersion,
    tables: slice.tables,
    rowCounts: Object.fromEntries(
      slice.tables.map((t) => [t.name, t.rowCount]),
    ),
    note: slice.note,
  };
}
