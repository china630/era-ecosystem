import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORG_SLICE_NOTE_HOTEL_V1,
  exportOrgSlice,
  exportOrgSliceLabSummary,
  importOrgSlice,
} from "./slice-export.js";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("exportOrgSlice", () => {
  it("exports only rows for the requested organizationId", async () => {
    const store = {
      guest: [
        { id: "g-a", organizationId: ORG_A, fullName: "Alice" },
        { id: "g-b", organizationId: ORG_B, fullName: "Bob" },
      ],
    };
    const slice = await exportOrgSlice({
      organizationId: ORG_A,
      models: {
        guest: {
          findMany: async ({ where }) =>
            store.guest.filter((g) => g.organizationId === where.organizationId),
        },
      },
    });
    assert.equal(slice.formatVersion, 1);
    assert.equal(slice.note, ORG_SLICE_NOTE_HOTEL_V1);
    assert.equal(slice.tables[0].rowCount, 1);
    assert.deepEqual(slice.rows.guest.map((g) => g.id), ["g-a"]);
  });
});

describe("importOrgSlice", () => {
  it("validate rejects organizationId mismatch", async () => {
    const slice = await exportOrgSlice({
      organizationId: ORG_A,
      models: {
        guest: {
          findMany: async () => [
            { id: "g-a", organizationId: ORG_A, fullName: "Alice" },
          ],
        },
      },
    });
    const result = await importOrgSlice({
      organizationId: ORG_B,
      modelOrder: ["guest"],
      models: {
        guest: {
          findMany: async () => [],
          create: async () => ({}),
        },
      },
      slice,
      mode: "validate",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /mismatch/);
  });

  it("upsert inserts exported rows for matching org", async () => {
    const created: Record<string, unknown>[] = [];
    const slice = await exportOrgSlice({
      organizationId: ORG_A,
      models: {
        guest: {
          findMany: async () => [
            { id: "g-a", organizationId: ORG_A, fullName: "Alice" },
          ],
        },
      },
    });
    const result = await importOrgSlice({
      organizationId: ORG_A,
      modelOrder: ["guest"],
      models: {
        guest: {
          findMany: async () => [],
          deleteMany: async () => ({}),
          create: async ({ data }) => {
            created.push(data);
            return data;
          },
        },
      },
      slice,
      mode: "upsert",
    });
    assert.equal(result.ok, true);
    assert.equal(created.length, 1);
    assert.equal(created[0].organizationId, ORG_A);
  });
});

describe("exportOrgSliceLabSummary", () => {
  it("returns lab note without not-implemented wording", () => {
    const meta = exportOrgSliceLabSummary(ORG_A);
    assert.equal(meta.organizationId, ORG_A);
    assert.match(meta.note, /hotel curated json slice v1/);
    assert.ok(!meta.note.includes("not implemented"));
    assert.ok(meta.rowCounts);
  });
});
