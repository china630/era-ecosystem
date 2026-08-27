import { z } from "zod";
import {
  assertHotelIdMatchesPolicy,
  isPolicyWriteEnabled,
  type ElektrawebBridgePolicyRow,
} from "@/lib/integration/elektraweb-bridge/config";

const enqueueSchema = z.object({
  organizationId: z.string().uuid(),
  source: z.enum(["CLINIC", "FNB"]).default("CLINIC"),
  idempotencyKey: z.string().min(4).max(120),
  patientOrigin: z.enum(["IN_HOUSE", "WALK_IN"]),
  amount: z.number().positive(),
  procedureCode: z.string().min(1),
  procedureName: z.string().min(1),
  description: z.string().min(1),
});

function policy(
  overrides: Partial<ElektrawebBridgePolicyRow> = {},
): ElektrawebBridgePolicyRow {
  return {
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    inboundEnabled: true,
    writeEnabled: true,
    elektrawebHotelId: 31606,
    spaDepId: 133387,
    spaCurrencyId: 10,
    walkinResId: "66246938",
    walkinResNameId: "100670215",
    ...overrides,
  };
}

describe("saas wave 1 tenant bridge", () => {
  const prevEnabled = process.env.ELEKTRAWEB_BRIDGE_ENABLED;

  afterEach(() => {
    if (prevEnabled === undefined) delete process.env.ELEKTRAWEB_BRIDGE_ENABLED;
    else process.env.ELEKTRAWEB_BRIDGE_ENABLED = prevEnabled;
  });

  it("requires organizationId on outbox POST body (POS / clinic)", () => {
    expect(() =>
      enqueueSchema.parse({
        idempotencyKey: "clinic-ticket-1",
        patientOrigin: "WALK_IN",
        procedureCode: "SVC-OZON",
        procedureName: "Ozon",
        amount: 17,
        description: "Ozon",
      }),
    ).toThrow();
    const ok = enqueueSchema.parse({
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "clinic-ticket-1",
      patientOrigin: "WALK_IN",
      procedureCode: "SVC-OZON",
      procedureName: "Ozon",
      amount: 17,
      description: "Ozon",
    });
    expect(ok.organizationId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("rejects HOTELID that is not this org policy (409-class mismatch)", () => {
    const a = policy({ organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", elektrawebHotelId: 31606 });
    expect(() => assertHotelIdMatchesPolicy(a, 31606)).not.toThrow();
    expect(() => assertHotelIdMatchesPolicy(a, 99999)).toThrow(/HOTELID mismatch/);
  });

  it("write drain requires process kill switch AND org writeEnabled", () => {
    process.env.ELEKTRAWEB_BRIDGE_ENABLED = "1";
    expect(isPolicyWriteEnabled(policy({ writeEnabled: true }))).toBe(true);
    expect(isPolicyWriteEnabled(policy({ writeEnabled: false }))).toBe(false);
    process.env.ELEKTRAWEB_BRIDGE_ENABLED = "0";
    expect(isPolicyWriteEnabled(policy({ writeEnabled: true }))).toBe(false);
  });

  it("does not use process-wide ELEKTRAWEB_HOTEL_ID for policy hotel id", () => {
    process.env.ELEKTRAWEB_HOTEL_ID = "11111";
    const orgB = policy({
      organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      elektrawebHotelId: 22222,
    });
    expect(() => assertHotelIdMatchesPolicy(orgB, 11111)).toThrow(/HOTELID mismatch/);
    expect(() => assertHotelIdMatchesPolicy(orgB, 22222)).not.toThrow();
  });
});
