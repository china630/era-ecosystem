/**
 * SaaS Wave 5 — lab two-org isolation (clinic).
 * Uses real kit tenancy (not mocked) — filter + ALS. No live SHARED pool claim.
 */
import { mergeWhere, mergeWhereForUnique } from "@era/satellite-kit/tenancy";
import {
  resolveSatelliteTenantOrgId,
  runWithSatelliteTenant,
} from "../../packages/satellite-kit/src/tenancy/satellite-tenant-context";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type PatientRow = {
  id: string;
  organizationId: string;
  refCode: string;
  fullName: string;
};

type AppointmentRow = {
  id: string;
  organizationId: string;
  patientId: string;
};

const patients: PatientRow[] = [
  { id: "pat-a", organizationId: ORG_A, refCode: "P1", fullName: "Alice A" },
  { id: "pat-b", organizationId: ORG_B, refCode: "P1", fullName: "Bob B" },
];

const appointments: AppointmentRow[] = [
  { id: "appt-a", organizationId: ORG_A, patientId: "pat-a" },
  { id: "appt-b", organizationId: ORG_B, patientId: "pat-b" },
];

/** Lab stand-in for Prisma findMany after createSatelliteTenantExtension mergeWhere. */
function listPatients(orgId: string, where: Record<string, unknown> = {}) {
  const merged = mergeWhere(where, orgId) as {
    AND: Array<{ organizationId?: string } & Record<string, unknown>>;
  };
  const orgClause = merged.AND.find((c) => c.organizationId)?.organizationId;
  return patients.filter((p) => p.organizationId === orgClause);
}

function getPatientById(orgId: string, id: string): PatientRow | null {
  const sel = mergeWhereForUnique({ id }, orgId) as {
    id: string;
    organizationId: string;
  };
  return (
    patients.find(
      (p) => p.id === sel.id && p.organizationId === sel.organizationId,
    ) ?? null
  );
}

function listAppointments(orgId: string) {
  const merged = mergeWhere({}, orgId) as {
    AND: Array<{ organizationId?: string }>;
  };
  const orgClause = merged.AND.find((c) => c.organizationId)?.organizationId;
  return appointments.filter((a) => a.organizationId === orgClause);
}

describe("saas wave 5 clinic two-org isolation (lab)", () => {
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

  it("under Org B ALS, patient list excludes Org A rows", () => {
    runWithSatelliteTenant({ organizationId: ORG_B }, () => {
      const orgId = resolveSatelliteTenantOrgId();
      expect(orgId).toBe(ORG_B);
      const rows = listPatients(orgId!);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("pat-b");
      expect(rows.find((r) => r.id === "pat-a")).toBeUndefined();
    });
  });

  it("under Org A ALS, appointment list excludes Org B", () => {
    runWithSatelliteTenant({ organizationId: ORG_A }, () => {
      const rows = listAppointments(resolveSatelliteTenantOrgId()!);
      expect(rows.map((r) => r.id)).toEqual(["appt-a"]);
    });
  });

  it("cross-org get by id returns empty (not Org A data under Org B)", () => {
    runWithSatelliteTenant({ organizationId: ORG_B }, () => {
      const orgId = resolveSatelliteTenantOrgId()!;
      expect(getPatientById(orgId, "pat-a")).toBeNull();
      expect(getPatientById(orgId, "pat-b")?.fullName).toBe("Bob B");
    });
  });

  it("same refCode is distinct unique per org", () => {
    expect(mergeWhereForUnique({ refCode: "P1" }, ORG_A)).toEqual({
      organizationId_refCode: { organizationId: ORG_A, refCode: "P1" },
    });
    expect(mergeWhereForUnique({ refCode: "P1" }, ORG_B)).toEqual({
      organizationId_refCode: { organizationId: ORG_B, refCode: "P1" },
    });
  });

  it("ALS Org A wins over process bind Org B for stamp", () => {
    expect(process.env.ERA_SATELLITE_ORGANIZATION_ID).toBe(ORG_B);
    runWithSatelliteTenant({ organizationId: ORG_A }, () => {
      expect(resolveSatelliteTenantOrgId()).toBe(ORG_A);
    });
  });
});
