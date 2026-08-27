/**
 * SaaS Wave 5 — lab two-org isolation (hotel).
 * Real kit tenancy filter + ALS. No live SHARED pool claim.
 */
import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";
import {
  resolveSatelliteTenantOrgId,
  runWithSatelliteTenant,
} from "../../packages/satellite-kit/src/tenancy/satellite-tenant-context";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type GuestRow = {
  id: string;
  organizationId: string;
  fullName: string;
};

type ReservationRow = {
  id: string;
  organizationId: string;
  guestId: string;
  status: string;
};

const guests: GuestRow[] = [
  { id: "gst-a", organizationId: ORG_A, fullName: "Alice Hotel" },
  { id: "gst-b", organizationId: ORG_B, fullName: "Bob Hotel" },
];

const reservations: ReservationRow[] = [
  { id: "res-a", organizationId: ORG_A, guestId: "gst-a", status: "IN_HOUSE" },
  { id: "res-b", organizationId: ORG_B, guestId: "gst-b", status: "IN_HOUSE" },
];

function listGuests(orgId: string) {
  const merged = mergeWhere({}, orgId) as {
    AND: Array<{ organizationId?: string }>;
  };
  const orgClause = merged.AND.find((c) => c.organizationId)?.organizationId;
  return guests.filter((g) => g.organizationId === orgClause);
}

function listReservations(orgId: string, where: Record<string, unknown> = {}) {
  const merged = mergeWhere(where, orgId) as {
    AND: Array<{ organizationId?: string } & Record<string, unknown>>;
  };
  const orgClause = merged.AND.find((c) => c.organizationId)?.organizationId;
  return reservations.filter((r) => r.organizationId === orgClause);
}

function getReservationById(orgId: string, id: string): ReservationRow | null {
  const sel = mergeWhereForUnique({ id }, orgId) as {
    id: string;
    organizationId: string;
  };
  return (
    reservations.find(
      (r) => r.id === sel.id && r.organizationId === sel.organizationId,
    ) ?? null
  );
}

describe("saas wave 5 hotel two-org isolation (lab)", () => {
  const prevBind = process.env.ERA_SATELLITE_ORGANIZATION_ID;
  const prevSkip = process.env.ERA_SKIP_TENANT_FILTER;

  beforeEach(() => {
    delete process.env.ERA_SKIP_TENANT_FILTER;
    process.env.ERA_SATELLITE_ORGANIZATION_ID = ORG_B;
  });

  afterEach(() => {
    if (prevBind === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevBind;
    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;
  });

  it("under Org B ALS, guest list excludes Org A", () => {
    runWithSatelliteTenant({ organizationId: ORG_B }, () => {
      const rows = listGuests(resolveSatelliteTenantOrgId()!);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("gst-b");
      expect(rows.find((r) => r.id === "gst-a")).toBeUndefined();
    });
  });

  it("under Org A ALS, reservation list excludes Org B", () => {
    runWithSatelliteTenant({ organizationId: ORG_A }, () => {
      const rows = listReservations(resolveSatelliteTenantOrgId()!, {
        status: "IN_HOUSE",
      });
      expect(rows.map((r) => r.id)).toEqual(["res-a"]);
    });
  });

  it("cross-org get by id returns empty under Org B", () => {
    runWithSatelliteTenant({ organizationId: ORG_B }, () => {
      const orgId = resolveSatelliteTenantOrgId()!;
      expect(getReservationById(orgId, "res-a")).toBeNull();
      expect(getReservationById(orgId, "res-b")?.guestId).toBe("gst-b");
    });
  });

  it("same roomNumber is distinct unique per org", () => {
    expect(mergeWhereForUnique({ roomNumber: "101" }, ORG_A)).toEqual({
      organizationId_roomNumber: { organizationId: ORG_A, roomNumber: "101" },
    });
    expect(mergeWhereForUnique({ roomNumber: "101" }, ORG_B)).toEqual({
      organizationId_roomNumber: { organizationId: ORG_B, roomNumber: "101" },
    });
  });

  it("ALS Org A wins over process bind Org B for stamp", () => {
    expect(process.env.ERA_SATELLITE_ORGANIZATION_ID).toBe(ORG_B);
    runWithSatelliteTenant({ organizationId: ORG_A }, () => {
      expect(resolveSatelliteTenantOrgId()).toBe(ORG_A);
    });
  });
});
