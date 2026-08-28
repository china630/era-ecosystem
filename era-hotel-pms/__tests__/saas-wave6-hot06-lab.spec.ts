/**
 * SaaS Wave 6 — HOT-06 lab negatives (Elektraweb dual-run / outbox org isolation).
 * Does not claim SHIPPED or field SPA Insert.
 */
import { z } from "zod";
import {
  assertHotelIdMatchesPolicy,
  isPolicyWriteEnabled,
  type ElektrawebBridgePolicyRow,
} from "@/lib/integration/elektraweb-bridge/config";
import {
  enterSatelliteTenant,
  resolveSatelliteTenantOrgId,
} from "../../packages/satellite-kit/src/tenancy/satellite-tenant-context";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    organizationId: ORG_A,
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

describe("saas wave 6 HOT-06 lab", () => {
  const prevEnabled = process.env.ELEKTRAWEB_BRIDGE_ENABLED;
  const prevBind = process.env.ERA_SATELLITE_ORGANIZATION_ID;

  beforeEach(() => {
    process.env.ELEKTRAWEB_BRIDGE_ENABLED = "1";
    process.env.ERA_SATELLITE_ORGANIZATION_ID = ORG_B;
  });

  afterEach(() => {
    if (prevEnabled === undefined) delete process.env.ELEKTRAWEB_BRIDGE_ENABLED;
    else process.env.ELEKTRAWEB_BRIDGE_ENABLED = prevEnabled;
    if (prevBind === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevBind;
  });

  it("outbox enqueue body requires hotel organizationId (clinic/POS stamp)", () => {
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
  });

  it("Org B HOTELID cannot satisfy Org A policy", () => {
    const a = policy({ organizationId: ORG_A, elektrawebHotelId: 31606 });
    const b = policy({ organizationId: ORG_B, elektrawebHotelId: 22222 });
    expect(() => assertHotelIdMatchesPolicy(a, 22222)).toThrow(/HOTELID mismatch/);
    expect(() => assertHotelIdMatchesPolicy(b, 31606)).toThrow(/HOTELID mismatch/);
    expect(() => assertHotelIdMatchesPolicy(b, 22222)).not.toThrow();
  });

  it("writeEnabled off refuses drain even when bridge kill switch on", () => {
    expect(isPolicyWriteEnabled(policy({ writeEnabled: false }))).toBe(false);
    expect(isPolicyWriteEnabled(policy({ writeEnabled: true }))).toBe(true);
  });

  it("process kill switch off refuses write even if policy writeEnabled", () => {
    process.env.ELEKTRAWEB_BRIDGE_ENABLED = "0";
    expect(isPolicyWriteEnabled(policy({ writeEnabled: true }))).toBe(false);
  });

  it("bridge ALS Org A wins over process bind Org B (same as enterBridgeTenant)", () => {
    expect(process.env.ERA_SATELLITE_ORGANIZATION_ID).toBe(ORG_B);
    enterSatelliteTenant({ organizationId: ORG_A });
    expect(resolveSatelliteTenantOrgId()).toBe(ORG_A);
  });

  it("stamped outbox organizationId is the hotel org from body, not process bind", () => {
    const body = enqueueSchema.parse({
      organizationId: ORG_A,
      idempotencyKey: "clinic-ticket-wave6",
      patientOrigin: "WALK_IN",
      procedureCode: "SVC-OZON",
      procedureName: "Ozon",
      amount: 17,
      description: "Ozon",
    });
    expect(body.organizationId).toBe(ORG_A);
    expect(body.organizationId).not.toBe(ORG_B);
  });
});
