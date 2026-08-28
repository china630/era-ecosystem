import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeWhere,
  mergeWhereForUnique,
  uniqueSelectorNames,
} from "./satellite-tenant-extension";
import {
  isSentinelOrganizationId,
  stampTenantCreateData,
  stampTenantCreateTree,
  TenantOrganizationMismatchError,
} from "./organization-id-guard";
import {
  assertTenantRawSqlMentionsOrg,
  SatelliteTenantRawSqlError,
} from "./tenant-raw-sql";
import type { SatellitePrisma, WithOptionalOrganizationId } from "./satellite-prisma-types";
import { asSatellitePrisma } from "./satellite-prisma-types";

describe("satellite tenant where merge", () => {
  it("AND-merges findMany filters", () => {
    assert.deepEqual(mergeWhere({ status: "OPEN" }, "org-a"), {
      AND: [{ organizationId: "org-a" }, { status: "OPEN" }],
    });
  });

  it("rewrites scalar code unique to composite", () => {
    assert.deepEqual(mergeWhereForUnique({ code: "ROOM" }, "org-a"), {
      organizationId_code: { organizationId: "org-a", code: "ROOM" },
    });
  });

  it("rewrites Date unique to composite (BusinessDay.date)", () => {
    const date = new Date("2026-08-22T00:00:00.000Z");
    assert.deepEqual(mergeWhereForUnique({ date }, "org-a"), {
      organizationId_date: { organizationId: "org-a", date },
    });
  });

  it("rewrites Date + organizationId pair to compound unique", () => {
    const date = new Date("2026-08-22T00:00:00.000Z");
    assert.deepEqual(
      mergeWhereForUnique({ date, organizationId: "nafta-sanatorium-org" }, "org-a"),
      { organizationId_date: { organizationId: "org-a", date } },
    );
  });

  it("keeps id unique and adds org (extendedWhereUnique)", () => {
    assert.deepEqual(mergeWhereForUnique({ id: "row-1" }, "org-a"), {
      id: "row-1",
      organizationId: "org-a",
    });
  });

  it("fills org inside existing compound selector", () => {
    assert.deepEqual(
      mergeWhereForUnique(
        { organizationId_refCode: { refCode: "P1", organizationId: "old" } },
        "org-a",
      ),
      {
        organizationId_refCode: { refCode: "P1", organizationId: "org-a" },
      },
    );
  });

  it("isolates the same business code across two orgs", () => {
    const code = "ROOM-101";
    assert.notDeepEqual(
      mergeWhereForUnique({ roomNumber: code }, "org-a"),
      mergeWhereForUnique({ roomNumber: code }, "org-b"),
    );
    assert.deepEqual(mergeWhereForUnique({ roomNumber: code }, "org-b"), {
      organizationId_roomNumber: { organizationId: "org-b", roomNumber: code },
    });
  });

  it("uses extendedWhereUnique when the scalar is already unique (ProgramInstance.episodeId)", () => {
    const uniques = uniqueSelectorNames({
      name: "ProgramInstance",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "episodeId", kind: "scalar", type: "String", isUnique: true },
        { name: "organizationId", kind: "scalar", type: "String" },
      ],
      uniqueFields: [],
      uniqueIndexes: [],
    });
    assert.deepEqual(mergeWhereForUnique({ episodeId: "ep-1" }, "org-a", uniques), {
      episodeId: "ep-1",
      organizationId: "org-a",
    });
  });

  it("still remaps when DMMF has organizationId_code", () => {
    const uniques = uniqueSelectorNames({
      name: "PatientRef",
      fields: [
        { name: "id", kind: "scalar", type: "String", isId: true },
        { name: "refCode", kind: "scalar", type: "String" },
        { name: "organizationId", kind: "scalar", type: "String" },
      ],
      uniqueFields: [["organizationId", "refCode"]],
      uniqueIndexes: [{ name: null, fields: ["organizationId", "refCode"] }],
    });
    assert.deepEqual(mergeWhereForUnique({ refCode: "P1" }, "org-a", uniques), {
      organizationId_refCode: { organizationId: "org-a", refCode: "P1" },
    });
  });
});

describe("tenant create stamp", () => {
  it("fills organizationId when omitted", () => {
    assert.deepEqual(stampTenantCreateData({ code: "R1" }, "org-a"), {
      code: "R1",
      organizationId: "org-a",
    });
  });

  it("rejects a client-supplied foreign organizationId", () => {
    assert.throws(
      () => stampTenantCreateData({ organizationId: "org-b" }, "org-a"),
      (err: unknown) => err instanceof TenantOrganizationMismatchError,
    );
  });
});

describe("tenant create tree stamp", () => {
  it("stamps nested relation create", () => {
    const stamped = stampTenantCreateTree(
      {
        code: "PC1",
        versions: { create: { sellAmount: 10, note: "v1" } },
      },
      "org-a",
    );
    assert.deepEqual(stamped, {
      code: "PC1",
      organizationId: "org-a",
      versions: {
        create: {
          sellAmount: 10,
          note: "v1",
          organizationId: "org-a",
        },
      },
    });
  });

  it("stamps createMany.data arrays", () => {
    const stamped = stampTenantCreateTree(
      {
        name: "parent",
        children: {
          createMany: { data: [{ code: "a" }, { code: "b" }] },
        },
      },
      "org-a",
    ) as Record<string, unknown>;
    assert.equal(stamped.organizationId, "org-a");
    const children = stamped.children as {
      createMany: { data: Array<{ code: string; organizationId: string }> };
    };
    assert.deepEqual(children.createMany.data, [
      { code: "a", organizationId: "org-a" },
      { code: "b", organizationId: "org-a" },
    ]);
  });

  it("stamps connectOrCreate.create only", () => {
    const stamped = stampTenantCreateTree(
      {
        title: "WO",
        room: {
          connectOrCreate: {
            where: { id: "r1" },
            create: { roomNumber: "101" },
          },
        },
      },
      "org-a",
    ) as Record<string, unknown>;
    const room = stamped.room as {
      connectOrCreate: { where: { id: string }; create: Record<string, unknown> };
    };
    assert.deepEqual(room.connectOrCreate.where, { id: "r1" });
    assert.deepEqual(room.connectOrCreate.create, {
      roomNumber: "101",
      organizationId: "org-a",
    });
  });

  it("rejects nested foreign organizationId", () => {
    assert.throws(
      () =>
        stampTenantCreateTree(
          { code: "X", child: { create: { organizationId: "org-b" } } },
          "org-a",
        ),
      (err: unknown) => err instanceof TenantOrganizationMismatchError,
    );
  });
});

describe("SatellitePrisma cast", () => {
  it("identity-casts client", () => {
    const mock = {
      $connect: async () => undefined,
      room: {
        create: async (_args: { data: { roomNumber: string; organizationId: string } }) => ({
          id: "1",
        }),
      },
    };
    const sat = asSatellitePrisma(mock);
    assert.equal(sat, mock);
  });

  it("type-level: organizationId optional on create data", () => {
    type CreateIn = { roomNumber: string; organizationId: string };
    type Relaxed = WithOptionalOrganizationId<CreateIn>;
    const row: Relaxed = { roomNumber: "101" };
    assert.equal(row.roomNumber, "101");
    type Client = {
      room: {
        create: (args: { data: CreateIn }) => Promise<{ id: string }>;
      };
    };
    type Sat = SatellitePrisma<Client>;
    const _check: Sat["room"]["create"] = async (args) => {
      void args.data.roomNumber;
      return { id: "x" };
    };
    void _check;
  });
});

describe("sentinel organization ids", () => {
  it("treats unbound as sentinel", () => {
    assert.equal(isSentinelOrganizationId("unbound", { production: false }), true);
  });

  it("allows demo-org outside production", () => {
    assert.equal(isSentinelOrganizationId("demo-org", { production: false }), false);
  });

  it("rejects demo-org in production", () => {
    assert.equal(isSentinelOrganizationId("demo-org", { production: true }), true);
  });
});

describe("raw SQL org mention", () => {
  it("accepts organization_id in SQL", () => {
    assertTenantRawSqlMentionsOrg("SELECT 1 FROM rooms WHERE organization_id = $1");
  });

  it("rejects SQL without org column", () => {
    assert.throws(
      () => assertTenantRawSqlMentionsOrg("SELECT * FROM rooms"),
      (err: unknown) => err instanceof SatelliteTenantRawSqlError,
    );
  });
});
