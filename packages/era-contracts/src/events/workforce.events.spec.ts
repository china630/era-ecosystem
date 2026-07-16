import { describe, expect, it } from "vitest";
import {
  WORKFORCE_ABSENCE_APPROVED,
  WORKFORCE_ORG_UNIT_UPSERTED,
  WORKFORCE_POSITION_UPSERTED,
  WORKFORCE_VACATION_PLAN_APPROVED,
  satelliteWorkforceAbsenceApprovedSchema,
  satelliteWorkforceOrgUnitUpsertedSchema,
  satelliteWorkforcePositionUpsertedSchema,
  satelliteWorkforceVacationPlanApprovedSchema,
  workforceAbsenceEventPayloadSchema,
  workforceOrgUnitPayloadSchema,
  workforcePositionPayloadSchema,
} from "./workforce.events";

describe("workforce absence events", () => {
  const payload = {
    cpAbsenceId: "550e8400-e29b-41d4-a716-446655440000",
    organizationId: "660e8400-e29b-41d4-a716-446655440001",
    employmentId: "770e8400-e29b-41d4-a716-446655440002",
    globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
    kind: "VACATION" as const,
    startDate: "2026-06-01",
    endDate: "2026-06-10",
    approvedAt: "2026-06-01T10:00:00.000Z",
    approvedByUserId: "990e8400-e29b-41d4-a716-446655440004",
  };

  it("parses workforce absence payload", () => {
    expect(workforceAbsenceEventPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("round-trips WORKFORCE_ABSENCE_APPROVED envelope", () => {
    const event = {
      type: WORKFORCE_ABSENCE_APPROVED,
      organizationId: payload.organizationId,
      correlationId: `${payload.cpAbsenceId}:APPROVED:1`,
      occurredAt: "2026-06-01T10:00:00.000Z",
      globalPersonId: payload.globalPersonId,
      payload,
    };
    expect(satelliteWorkforceAbsenceApprovedSchema.parse(event)).toEqual(event);
  });
});

describe("workforce org events", () => {
  const orgPayload = {
    cpOrgUnitId: "550e8400-e29b-41d4-a716-446655440000",
    workforceScopeId: "660e8400-e29b-41d4-a716-446655440001",
    anchorOrganizationId: "770e8400-e29b-41d4-a716-446655440002",
    name: "Med Block",
    costCenterCode: "MED-01",
  };

  it("parses org unit payload", () => {
    expect(workforceOrgUnitPayloadSchema.parse(orgPayload)).toEqual(orgPayload);
  });

  it("round-trips WORKFORCE_ORG_UNIT_UPSERTED envelope", () => {
    const event = {
      type: WORKFORCE_ORG_UNIT_UPSERTED,
      organizationId: orgPayload.anchorOrganizationId,
      correlationId: `${orgPayload.cpOrgUnitId}:UPSERT:1`,
      occurredAt: "2026-06-01T10:00:00.000Z",
      payload: orgPayload,
    };
    expect(satelliteWorkforceOrgUnitUpsertedSchema.parse(event)).toEqual(event);
  });

  it("parses position payload", () => {
    const posPayload = {
      cpPositionId: "880e8400-e29b-41d4-a716-446655440003",
      cpOrgUnitId: orgPayload.cpOrgUnitId,
      organizationId: orgPayload.anchorOrganizationId,
      name: "Therapist",
      totalSlots: 2,
    };
    expect(workforcePositionPayloadSchema.parse(posPayload)).toEqual(posPayload);
    const event = {
      type: WORKFORCE_POSITION_UPSERTED,
      organizationId: posPayload.organizationId,
      correlationId: `${posPayload.cpPositionId}:UPSERT:1`,
      occurredAt: "2026-06-01T10:00:00.000Z",
      payload: posPayload,
    };
    expect(satelliteWorkforcePositionUpsertedSchema.parse(event)).toEqual(event);
  });
});

describe("workforce vacation plan events", () => {
  it("round-trips WORKFORCE_VACATION_PLAN_APPROVED envelope", () => {
    const payload = {
      cpVacationPlanId: "550e8400-e29b-41d4-a716-446655440010",
      organizationId: "660e8400-e29b-41d4-a716-446655440011",
      year: 2026,
      approvedAt: "2026-07-01T10:00:00.000Z",
      approvedByUserId: "770e8400-e29b-41d4-a716-446655440012",
      lines: [
        {
          employmentId: "880e8400-e29b-41d4-a716-446655440013",
          globalPersonId: "990e8400-e29b-41d4-a716-446655440014",
          startDate: "2026-08-01",
          endDate: "2026-08-14",
          days: 14,
        },
      ],
    };
    const event = {
      type: WORKFORCE_VACATION_PLAN_APPROVED,
      organizationId: payload.organizationId,
      correlationId: `${payload.cpVacationPlanId}:APPROVED:1`,
      occurredAt: payload.approvedAt,
      payload,
    };
    expect(satelliteWorkforceVacationPlanApprovedSchema.parse(event)).toEqual(event);
  });
});
