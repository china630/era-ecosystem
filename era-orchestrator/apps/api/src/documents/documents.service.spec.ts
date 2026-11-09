import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { DocDecisionOutcome, DocStatus } from "@era365/database";
import { DocumentsService } from "./documents.service";

function service(overrides: {
  doc?: Record<string, unknown>;
  assignees?: Array<{ employmentId: string; userId: string | null; orgUnitId: string; orgUnitName: string }>;
  actor?: boolean;
}) {
  const doc = {
    id: "case-1",
    organizationId: "org-1",
    kind: "INCOMING",
    status: DocStatus.REGISTERED,
    title: "Letter",
    regNumber: "IN-2026-0001",
    authorEmploymentId: "emp-author",
    templateId: "tpl-1",
    route: null,
    locationId: null,
    ...overrides.doc,
  };
  const template = {
    id: "tpl-1",
    docKind: "INCOMING",
    steps: [
      {
        stepOrder: 1,
        kind: "ORG_UNIT_HEAD",
        action: "APPROVE",
        appliesTo: "ALWAYS",
        dueDays: 3,
        orgUnitId: null,
        positionId: null,
        chainOffset: null,
        minGradeLevel: null,
      },
    ],
  };
  const prisma = {
    organizationMembership: { findFirst: jest.fn().mockResolvedValue({ userId: "user-1" }) },
    workforceEmployment: {
      findFirst: jest.fn().mockResolvedValue({ position: { leadership: false }, platformUserId: "user-author" }),
    },
    docCase: {
      findFirst: jest.fn().mockResolvedValue({ ...doc, files: [], route: doc.route, template, replyTo: null, location: null }),
      update: jest.fn().mockResolvedValue(doc),
    },
    docRouteTemplate: { findFirst: jest.fn().mockResolvedValue(template) },
    docRouteInstance: { create: jest.fn().mockResolvedValue({ id: "inst-1", tasks: [] }) },
    docRouteTask: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    docRouteDecision: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  const approval = {
    resolveStepAssignees: jest.fn().mockResolvedValue(
      overrides.assignees ?? [
        { employmentId: "emp-head", userId: "user-head", orgUnitId: "u", orgUnitName: "Office" },
      ],
    ),
    actorIsAssignee: jest.fn().mockResolvedValue(overrides.actor ?? true),
  };
  const comms = { createThread: jest.fn().mockResolvedValue({}) };
  const documents = new DocumentsService(prisma as never, approval as never, comms as never);
  return { documents, prisma, approval };
}

describe("DocumentsService route gates", () => {
  it("refuses a second start", async () => {
    const { documents } = service({ doc: { route: { id: "already" } } });
    await expect(documents.start("org-1", "user-1", "case-1")).rejects.toMatchObject({
      response: { code: "DOC_ROUTE_ALREADY_STARTED" },
    });
  });

  it("keeps the route open when a step has nobody to assign", async () => {
    const { documents, prisma } = service({ assignees: [] });
    await documents.start("org-1", "user-1", "case-1");
    const data = prisma.docRouteInstance.create.mock.calls[0][0].data;
    expect(data.awaitingAssignment).toBe(true);
    expect(data.tasks).toBeUndefined();
  });

  it("refuses a second manual assign", async () => {
    const { documents, prisma } = service({});
    prisma.docRouteInstance = {
      findFirst: jest.fn().mockResolvedValue({ awaitingAssignment: false }),
    };
    await expect(documents.assign("org-1", "user-1", "case-1", "emp-head")).rejects.toMatchObject({
      response: { code: "DOC_ASSIGN_NOT_WAITING" },
    });
  });

  it("refuses a decision from the wrong seat", async () => {
    const { documents, prisma } = service({ actor: false });
    prisma.docRouteTask.findFirst.mockResolvedValue({
      id: "task-1",
      status: "OPEN",
      action: "APPROVE",
      stepOrder: 1,
      assigneeEmploymentId: "emp-head",
      assigneeUserId: "user-head",
      instanceId: "inst-1",
      instance: {
        case: {
          id: "case-1",
          title: "Letter",
          regNumber: "IN-2026-0001",
          authorEmploymentId: "emp-author",
        },
        template: { steps: [] },
      },
    });
    await expect(
      documents.decide("org-1", "user-other", "task-1", { outcome: DocDecisionOutcome.APPROVED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses registering a document that is not a draft", async () => {
    const { documents } = service({});
    await expect(documents.register("org-1", "user-1", "case-1")).rejects.toMatchObject({
      response: { code: "DOC_NOT_DRAFT" },
    });
  });
});
