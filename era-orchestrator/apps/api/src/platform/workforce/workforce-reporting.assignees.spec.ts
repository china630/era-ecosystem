import { WorkforceApprovalStepKind } from "@era365/database";
import { WorkforceApprovalService } from "./workforce-approval.service";

describe("WorkforceApprovalService assignees kinds", () => {
  const prisma = {
    workforceEmployment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    orgUnit: { findMany: jest.fn() },
    workforceApprovalRoute: { findFirst: jest.fn() },
  };
  const svc = new WorkforceApprovalService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  async function callAssignees(
    step: {
      kind: WorkforceApprovalStepKind;
      orgUnitId?: string | null;
      positionId?: string | null;
      chainOffset?: number | null;
      minGradeLevel?: number | null;
    },
  ) {
    // placeActor path uses private assignees via label/assert — invoke through
    // reflective access to keep test focused on switch coverage.
    const fn = (
      svc as unknown as {
        assignees: (
          organizationId: string,
          employmentId: string,
          step: {
            kind: WorkforceApprovalStepKind;
            orgUnitId: string | null;
            positionId: string | null;
            chainOffset: number | null;
            minGradeLevel: number | null;
          },
        ) => Promise<Array<{ employmentId: string }>>;
      }
    ).assignees.bind(svc);

    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "nurse",
      orgUnitId: "ward",
      workforceScopeId: "scope1",
      status: "ACTIVE",
      managerEmploymentId: "boss",
      matrixManagerEmploymentId: "matrix",
      platformUserId: null,
    });
    prisma.orgUnit.findMany.mockResolvedValue([
      {
        id: "ward",
        parentId: "med",
        name: "Ward",
        managerEmploymentId: null,
        managerUserId: null,
      },
      {
        id: "med",
        parentId: null,
        name: "Med",
        managerEmploymentId: "chief",
        managerUserId: null,
      },
    ]);
    prisma.workforceEmployment.findMany.mockResolvedValue([
      {
        id: "nurse",
        orgUnitId: "ward",
        status: "ACTIVE",
        managerEmploymentId: "boss",
        matrixManagerEmploymentId: "matrix",
        platformUserId: null,
      },
      {
        id: "boss",
        orgUnitId: "med",
        status: "ACTIVE",
        managerEmploymentId: null,
        matrixManagerEmploymentId: null,
        platformUserId: "u-boss",
      },
      {
        id: "matrix",
        orgUnitId: "med",
        status: "ACTIVE",
        managerEmploymentId: null,
        matrixManagerEmploymentId: null,
        platformUserId: "u-m",
      },
      {
        id: "chief",
        orgUnitId: "med",
        status: "ACTIVE",
        managerEmploymentId: null,
        matrixManagerEmploymentId: null,
        platformUserId: "u-c",
      },
    ]);

    return fn("org1", "nurse", {
      kind: step.kind,
      orgUnitId: step.orgUnitId ?? null,
      positionId: step.positionId ?? null,
      chainOffset: step.chainOffset ?? null,
      minGradeLevel: step.minGradeLevel ?? null,
    });
  }

  it("REQUESTER_MANAGER uses solid line", async () => {
    const hit = await callAssignees({
      kind: WorkforceApprovalStepKind.REQUESTER_MANAGER,
    });
    expect(hit.map((h) => h.employmentId)).toEqual(["boss"]);
  });

  it("MATRIX_MANAGER uses dotted line", async () => {
    const hit = await callAssignees({
      kind: WorkforceApprovalStepKind.MATRIX_MANAGER,
    });
    expect(hit.map((h) => h.employmentId)).toEqual(["matrix"]);
  });

  it("GRADE_AT_LEAST without min returns empty", async () => {
    const hit = await callAssignees({
      kind: WorkforceApprovalStepKind.GRADE_AT_LEAST,
      minGradeLevel: null,
    });
    expect(hit).toEqual([]);
  });

  it("GRADE_AT_LEAST queries seats at grade", async () => {
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "nurse",
      orgUnitId: "ward",
      workforceScopeId: "scope1",
      status: "ACTIVE",
      managerEmploymentId: null,
      matrixManagerEmploymentId: null,
      platformUserId: null,
    });
    prisma.orgUnit.findMany.mockResolvedValue([]);
    prisma.workforceEmployment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "senior",
          platformUserId: "u-s",
          orgUnitId: "med",
          orgUnit: { name: "Med" },
        },
      ]);

    const fn = (
      svc as unknown as {
        assignees: (
          organizationId: string,
          employmentId: string,
          step: {
            kind: WorkforceApprovalStepKind;
            orgUnitId: string | null;
            positionId: string | null;
            chainOffset: number | null;
            minGradeLevel: number | null;
          },
        ) => Promise<Array<{ employmentId: string }>>;
      }
    ).assignees.bind(svc);

    const hit = await fn("org1", "nurse", {
      kind: WorkforceApprovalStepKind.GRADE_AT_LEAST,
      orgUnitId: null,
      positionId: null,
      chainOffset: null,
      minGradeLevel: 5,
    });
    expect(hit.map((h) => h.employmentId)).toEqual(["senior"]);
  });
});
