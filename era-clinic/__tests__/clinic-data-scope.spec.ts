import {
  CLINIC_PERMISSION,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/auth/clinic-permissions";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import {
  episodeAssignedToPractitionerWhere,
  labOrderAssignedToPractitionerWhere,
} from "@/lib/auth/clinic-data-scope";

describe("Clinic data scope (scope:*.all)", () => {
  it("defaults: reception/nurse/admin have episode ALL; doctor does not", () => {
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.RECEPTION],
    ).toContain(CLINIC_PERMISSION.SCOPE_EPISODES_ALL);
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.NURSE],
    ).toContain(CLINIC_PERMISSION.SCOPE_EPISODES_ALL);
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN],
    ).toContain(CLINIC_PERMISSION.SCOPE_EPISODES_ALL);
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    ).not.toContain(CLINIC_PERMISSION.SCOPE_EPISODES_ALL);
  });

  it("defaults: lab ALL for reception/nurse/lab/admin; doctor assigned", () => {
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.LAB_TECH],
    ).toContain(CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL);
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    ).not.toContain(CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL);
  });

  it("defaults: doctor has no patients screen/API", () => {
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    ).not.toContain(CLINIC_PERMISSION.SCREEN_PATIENTS);
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    ).not.toContain(CLINIC_PERMISSION.API_PATIENTS);
  });

  it("episode assigned where includes visit, prescription, allocation", () => {
    const where = episodeAssignedToPractitionerWhere("prac-1");
    expect(where).toEqual({
      OR: [
        { visits: { some: { practitionerId: "prac-1" } } },
        {
          procedureOrders: {
            some: { prescribedByPractitionerId: "prac-1" },
          },
        },
        {
          procedureOrders: {
            some: { allocations: { some: { practitionerId: "prac-1" } } },
          },
        },
      ],
    });
  });

  it("lab assigned where ties visit or assigned episode", () => {
    const where = labOrderAssignedToPractitionerWhere("prac-1");
    expect(where.OR).toHaveLength(2);
    expect(where.OR?.[0]).toEqual({
      visit: { is: { practitionerId: "prac-1" } },
    });
  });
});
