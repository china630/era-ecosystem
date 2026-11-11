import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_FULL_SLICE_FORMAT_VERSION,
  exportFullOrgSlice,
  importFullOrgSlice,
  orderTenantModelsByFk,
  prismaClientKeyForModel,
  type PrismaDmmfLike,
} from "./full-org-slice";

const PrismaMock: PrismaDmmfLike = {
  dmmf: {
    datamodel: {
      models: [
        {
          name: "Role",
          fields: [
            { name: "organizationId", kind: "scalar", type: "String" },
            { name: "id", kind: "scalar", type: "String" },
          ],
        },
        {
          name: "User",
          fields: [
            { name: "organizationId", kind: "scalar", type: "String" },
            { name: "roleId", kind: "scalar", type: "String" },
            {
              name: "role",
              kind: "object",
              type: "Role",
              relationFromFields: ["roleId"],
              relationToFields: ["id"],
            },
          ],
        },
      ],
    },
  },
};

describe("full-org-slice", () => {
  it("orders FK parents before children", () => {
    const order = orderTenantModelsByFk(PrismaMock, ["User", "Role"]);
    assert.deepEqual(order, ["Role", "User"]);
  });

  it("maps Prisma model name to client key", () => {
    assert.equal(prismaClientKeyForModel("RoomType"), "roomType");
  });

  it("export + import round-trip for one org", async () => {
    const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const store: Record<string, Record<string, unknown>[]> = {
      Role: [{ id: "r1", organizationId: org, code: "ADMIN" }],
      User: [{ id: "u1", organizationId: org, roleId: "r1", login: "a" }],
    };
    const models = {
      Role: {
        findMany: async ({ where }: { where: { organizationId: string } }) =>
          store.Role.filter((r) => r.organizationId === where.organizationId),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          store.Role.push(data);
          return data;
        },
        deleteMany: async ({
          where,
        }: {
          where: { organizationId: string };
        }) => {
          store.Role = store.Role.filter(
            (r) => r.organizationId !== where.organizationId,
          );
        },
      },
      User: {
        findMany: async ({ where }: { where: { organizationId: string } }) =>
          store.User.filter((r) => r.organizationId === where.organizationId),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          store.User.push(data);
          return data;
        },
        deleteMany: async ({
          where,
        }: {
          where: { organizationId: string };
        }) => {
          store.User = store.User.filter(
            (r) => r.organizationId !== where.organizationId,
          );
        },
      },
    };

    const slice = await exportFullOrgSlice({
      organizationId: org,
      satelliteKey: "industry_hotel_pms",
      modelOrder: ["Role", "User"],
      models,
    });
    assert.equal(slice.formatVersion, ORG_FULL_SLICE_FORMAT_VERSION);
    assert.equal(slice.tables.find((t) => t.name === "User")?.rowCount, 1);
    assert.equal(slice.objectStorage.stub, true);

    const result = await importFullOrgSlice({
      organizationId: org,
      models,
      slice,
      mode: "upsert",
    });
    assert.equal(result.ok, true);
    assert.equal(store.User.length, 1);

    const bad = await importFullOrgSlice({
      organizationId: org,
      models,
      slice: { ...slice, checksum: "deadbeef" },
      mode: "validate",
    });
    assert.equal(bad.ok, false);
    assert.match(String((bad as { reason?: string }).reason), /checksum/);

    const emptyOrder = await importFullOrgSlice({
      organizationId: org,
      models,
      slice: { ...slice, modelOrder: [], checksum: slice.checksum },
      mode: "validate",
    });
    assert.equal(emptyOrder.ok, false);
    assert.match(String((emptyOrder as { reason?: string }).reason), /modelOrder/);
  });
});
