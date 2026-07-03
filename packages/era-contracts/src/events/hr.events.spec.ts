import { describe, expect, it } from "vitest";
import {
  SATELLITE_STAFF_PROVISIONED,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
  staffDeactivatedPayloadSchema,
  staffProvisionedPayloadSchema,
} from "./hr.events";

describe("staff provision events v2", () => {
  const cpEmploymentId = "550e8400-e29b-41d4-a716-446655440000";

  it("parses provision payload with cpEmploymentId", () => {
    const payload = {
      cpEmploymentId,
      satelliteKey: "industry_clinic",
      satelliteRole: "DOCTOR",
      staffCode: "ABCD1234",
      fullName: "Ivan Test",
    };
    expect(staffProvisionedPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("round-trips STAFF_PROVISIONED envelope", () => {
    const event = {
      type: SATELLITE_STAFF_PROVISIONED,
      organizationId: "660e8400-e29b-41d4-a716-446655440001",
      correlationId: "c1",
      occurredAt: "2026-06-01T00:00:00.000Z",
      globalPersonId: "770e8400-e29b-41d4-a716-446655440002",
      payload: {
        cpEmploymentId,
        satelliteKey: "industry_clinic",
        satelliteRole: "DOCTOR",
        staffCode: "ABCD1234",
        fullName: "Ivan Test",
      },
    };
    expect(satelliteStaffProvisionedSchema.parse(event)).toEqual(event);
  });

  it("parses deactivate payload with cpEmploymentId", () => {
    const payload = {
      cpEmploymentId,
      satelliteKey: "industry_clinic",
      staffCode: "ABCD1234",
    };
    expect(staffDeactivatedPayloadSchema.parse(payload)).toEqual(payload);
    const event = {
      type: "STAFF_DEACTIVATED",
      organizationId: "660e8400-e29b-41d4-a716-446655440001",
      correlationId: "c2",
      occurredAt: "2026-06-01T00:00:00.000Z",
      payload,
    };
    expect(satelliteStaffDeactivatedSchema.parse(event)).toEqual(event);
  });
});
