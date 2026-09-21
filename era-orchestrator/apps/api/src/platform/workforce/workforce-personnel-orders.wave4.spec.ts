import { BadRequestException } from "@nestjs/common";
import {
  WorkforcePersonnelOrderStatus,
  WorkforcePersonnelOrderType,
} from "@era365/database";
import { WorkforcePersonnelOrdersService } from "./workforce-personnel-orders.service";
import {
  applyTemplatePlaceholders,
  formatOrderNumber,
} from "./personnel-order-template.util";
import { WORKFORCE_AUDIT_ACTIONS } from "./workforce-audit-actions";

jest.mock("pdfkit", () => {
  const texts: string[] = [];
  (globalThis as { __pdfPreviewTexts?: string[] }).__pdfPreviewTexts = texts;
  const PdfKit = jest.fn().mockImplementation(() => {
    const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
    const doc = {
      on: (ev: string, cb: (...a: unknown[]) => void) => {
        (handlers[ev] ??= []).push(cb);
        return doc;
      },
      font: () => doc,
      fontSize: () => doc,
      text: (s?: string) => {
        if (typeof s === "string") texts.push(s);
        return doc;
      },
      end: () => {
        for (const cb of handlers.data ?? []) cb(Buffer.from("%PDF-mock"));
        for (const cb of handlers.end ?? []) cb();
      },
    };
    return doc;
  });
  return { __esModule: true, default: PdfKit };
});

jest.mock("../../reporting/pdf-font.util", () => ({
  PDF_FONT_UNICODE: "Mock",
  registerUnicodeFonts: jest.fn(),
}));

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCOPE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EMP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERSON = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ORDER = "11111111-1111-4111-8111-111111111111";

describe("personnel-order-template.util", () => {
  it("formats per-type number series", () => {
    expect(formatOrderNumber("HIRE", 2026, 12)).toBe("EQ-2026-00012");
    expect(formatOrderNumber("LEAVE_ANNUAL", 2026, 1)).toBe("EM-2026-00001");
  });

  it("applies placeholders", () => {
    const out = applyTemplatePlaceholders("Hi {{person.fullName}}", {
      person: { fullName: "Ivanov" },
    });
    expect(out).toBe("Hi Ivanov");
  });
});

describe("WorkforcePersonnelOrdersService wave 4", () => {
  const prisma: any = {
    organization: { findFirst: jest.fn() },
    workforceEmployment: { findFirst: jest.fn() },
    workforcePersonnelOrder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    workforcePersonnelOrderTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const scopeService = {
    resolveScopeForCommercialOrg: jest.fn(),
  };
  const mdm = { getPersonOpsProfile: jest.fn() };
  const employments = { resolvePersonProfiles: jest.fn() };
  const financeMirror = { fetchEmploymentMirror: jest.fn() };

  const svc = new WorkforcePersonnelOrdersService(
    prisma,
    entitlement as never,
    audit as never,
    scopeService as never,
    mdm as never,
    employments as never,
    financeMirror as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    const g = globalThis as { __pdfPreviewTexts?: string[] };
    if (g.__pdfPreviewTexts) g.__pdfPreviewTexts.length = 0;
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    scopeService.resolveScopeForCommercialOrg.mockResolvedValue({
      workforceScope: { id: SCOPE, anchorOrganizationId: ORG_A },
      workforceScopeId: SCOPE,
    });
    prisma.organization.findFirst.mockResolvedValue({
      name: "Evrostar",
      settings: { taxId: "1234567890" },
      holdingId: null,
    });
    mdm.getPersonOpsProfile.mockResolvedValue({
      fullName: "Ivanov Ivan",
      firstName: "Ivan",
      middleName: "",
      lastName: "Ivanov",
    });
    financeMirror.fetchEmploymentMirror.mockResolvedValue({
      salary: 800,
      vacationDaysBalance: 14.5,
      employmentStatus: "ACTIVE",
    });
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP,
      globalPersonId: PERSON,
      hireDate: new Date("2026-01-01"),
      orgUnit: { name: "Ops" },
      position: { name: "Cleaner" },
    });
    prisma.workforcePersonnelOrder.aggregate.mockResolvedValue({
      _max: { sequenceSeq: 0 },
    });
    prisma.workforcePersonnelOrderTemplate.findFirst.mockResolvedValue(null);
  });

  it("ISSUED LEAVE snapshot contains leave.remainingDays from Finance mock", async () => {
    prisma.workforcePersonnelOrder.create.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));

    const row = await svc.create(ORG_A, USER, {
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      effectiveDate: "2026-06-01",
      leaveStartDate: "2026-06-01",
      leaveEndDate: "2026-06-14",
      issue: true,
      locale: "az",
    });

    expect(row.status).toBe(WorkforcePersonnelOrderStatus.ISSUED);
    expect(row.contextJson).toMatchObject({
      leave: { remainingDays: 14.5 },
      salary: { contract: "800" },
    });
    expect(financeMirror.fetchEmploymentMirror).toHaveBeenCalledWith(ORG_A, EMP);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PERSONNEL_ORDER_ISSUED",
        cpEmploymentId: EMP,
        globalPersonId: PERSON,
      }),
    );
  });

  it("issue without hr_full/mirror still works with remaining null", async () => {
    financeMirror.fetchEmploymentMirror.mockResolvedValue({
      salary: null,
      vacationDaysBalance: null,
      employmentStatus: null,
    });
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValue({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.DRAFT,
      workforceScopeId: SCOPE,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      orderNumber: "EM-2026-00001",
      locale: "az",
      note: "",
      personDisplayName: "Ivanov",
      effectiveDate: new Date("2026-06-01"),
      contextJson: null,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    });
    prisma.workforcePersonnelOrder.update.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      orderNumber: "EM-2026-00001",
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));

    const updated = await svc.issue(ORG_A, ORDER, USER);
    expect(updated.status).toBe(WorkforcePersonnelOrderStatus.ISSUED);
    expect(updated.contextJson).toMatchObject({
      leave: { remainingDays: null },
    });
  });

  it("numbering is independent per org and type", async () => {
    prisma.workforcePersonnelOrder.aggregate
      .mockResolvedValueOnce({ _max: { sequenceSeq: 3 } })
      .mockResolvedValueOnce({ _max: { sequenceSeq: 1 } });
    prisma.workforcePersonnelOrder.create.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));

    const hireA = await svc.create(ORG_A, USER, {
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.HIRE,
      effectiveDate: "2026-03-01",
    });
    expect(hireA.orderNumber).toBe("EQ-2026-00004");

    const leaveA = await svc.create(ORG_A, USER, {
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      effectiveDate: "2026-03-01",
    });
    expect(leaveA.orderNumber).toBe("EM-2026-00002");
  });

  it("cancel DRAFT ok; cancel ISSUED → 400", async () => {
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValueOnce({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.DRAFT,
      workforceScopeId: SCOPE,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.HIRE,
      orderNumber: "EQ-2026-00001",
      employment: { globalPersonId: PERSON, orgUnit: {}, position: {} },
    });
    prisma.workforcePersonnelOrder.update.mockResolvedValue({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.CANCELLED,
      type: WorkforcePersonnelOrderType.HIRE,
      orderNumber: "EQ-2026-00001",
      employment: { globalPersonId: PERSON, orgUnit: {}, position: {} },
    });
    await svc.cancel(ORG_A, ORDER, USER);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PERSONNEL_ORDER_CANCELLED" }),
    );

    prisma.workforcePersonnelOrder.findFirst.mockResolvedValueOnce({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.ISSUED,
      workforceScopeId: SCOPE,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.HIRE,
      orderNumber: "EQ-2026-00001",
      employment: { globalPersonId: PERSON, orgUnit: {}, position: {} },
    });
    await expect(svc.cancel(ORG_A, ORDER, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("DRAFT LEAVE keeps leave dates so issue() snapshot merges them", async () => {
    prisma.workforcePersonnelOrder.create.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));
    const draft = await svc.create(ORG_A, USER, {
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      effectiveDate: "2026-07-01",
      leaveStartDate: "2026-07-01",
      leaveEndDate: "2026-07-14",
      issue: false,
    });
    expect(draft.contextJson).toMatchObject({
      leave: { startDate: "2026-07-01", endDate: "2026-07-14" },
    });

    prisma.workforcePersonnelOrder.findFirst.mockResolvedValue({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.DRAFT,
      workforceScopeId: SCOPE,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      orderNumber: draft.orderNumber,
      locale: "az",
      note: "",
      personDisplayName: "Ivanov",
      effectiveDate: new Date("2026-07-01"),
      contextJson: draft.contextJson,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    });
    prisma.workforcePersonnelOrder.update.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
      orderNumber: draft.orderNumber,
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));
    const issued = await svc.issue(ORG_A, ORDER, USER);
    expect(issued.contextJson).toMatchObject({
      leave: {
        startDate: "2026-07-01",
        endDate: "2026-07-14",
        remainingDays: 14.5,
      },
    });
  });

  it("ensureDraftForMutation creates DRAFT HIRE once", async () => {
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValueOnce(null);
    prisma.workforcePersonnelOrder.create.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));
    const created = await svc.ensureDraftForMutation({
      organizationId: ORG_A,
      actorUserId: USER,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.HIRE,
      effectiveDate: "2026-01-15",
    });
    expect(created.status).toBe(WorkforcePersonnelOrderStatus.DRAFT);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PERSONNEL_ORDER_CREATED" }),
    );

    prisma.workforcePersonnelOrder.findFirst.mockResolvedValueOnce({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.DRAFT,
    });
    const again = await svc.ensureDraftForMutation({
      organizationId: ORG_A,
      actorUserId: USER,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.HIRE,
      effectiveDate: "2026-01-15",
    });
    expect(again.id).toBe(ORDER);
    expect(prisma.workforcePersonnelOrder.create).toHaveBeenCalledTimes(1);
  });

  it("previewTemplatePdf returns PDF buffer without creating an order", async () => {
    const { buffer, filename } = await svc.previewTemplatePdf(ORG_A, {
      type: WorkforcePersonnelOrderType.HIRE,
      locale: "az",
      bodyHtml: "<p>{{person.fullName}} — {{order.number}}</p>",
    });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(filename).toBe("template-preview-HIRE-az.pdf");
    const previewPlain = (
      (globalThis as { __pdfPreviewTexts?: string[] }).__pdfPreviewTexts ?? []
    ).join("\n");
    expect(previewPlain).toContain("Sample Person");
    expect(previewPlain).toMatch(/EQ-\d{4}-00001/);
    expect(prisma.workforcePersonnelOrder.create).not.toHaveBeenCalled();
    expect(entitlement.assertWorkforceHub).toHaveBeenCalledWith(ORG_A);
  });

  it("PDF download writes PERSONNEL_ORDER_PDF_DOWNLOADED with cpEmploymentId", async () => {
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValue({
      id: ORDER,
      status: WorkforcePersonnelOrderStatus.ISSUED,
      workforceScopeId: SCOPE,
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.HIRE,
      orderNumber: "EQ-2026-00001",
      locale: "az",
      note: "",
      personDisplayName: "Ivanov",
      effectiveDate: new Date("2026-01-01"),
      contextJson: {
        person: { fullName: "Ivanov" },
        order: { number: "EQ-2026-00001", effectiveDate: "2026-01-01", note: "—" },
        employment: { position: "Cleaner", orgUnit: "Ops" },
        org: { name: "Evrostar", voen: "—" },
        salary: { contract: "800" },
        leave: { remainingDays: null },
      },
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    });
    const { buffer } = await svc.buildPdfBuffer(ORG_A, ORDER, USER);
    expect(buffer.length).toBeGreaterThan(0);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PERSONNEL_ORDER_PDF_DOWNLOADED",
        cpEmploymentId: EMP,
      }),
    );
  });

  it("org A vs B use separate aggregates (numbering isolation)", async () => {
    prisma.workforcePersonnelOrder.aggregate.mockImplementation(
      async (args: { where: { organizationId: string } }) => {
        if (args.where.organizationId === ORG_A) {
          return { _max: { sequenceSeq: 10 } };
        }
        return { _max: { sequenceSeq: 2 } };
      },
    );
    prisma.workforcePersonnelOrder.create.mockImplementation(async ({ data }: any) => ({
      id: ORDER,
      ...data,
      employment: {
        id: EMP,
        globalPersonId: PERSON,
        orgUnit: { name: "Ops" },
        position: { name: "Cleaner" },
      },
    }));
    const a = await svc.create(ORG_A, USER, {
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.TERMINATE,
      effectiveDate: "2026-04-01",
    });
    const b = await svc.create(ORG_B, USER, {
      employmentId: EMP,
      type: WorkforcePersonnelOrderType.TERMINATE,
      effectiveDate: "2026-04-01",
    });
    expect(a.orderNumber).toBe("EX-2026-00011");
    expect(b.orderNumber).toBe("EX-2026-00003");
  });
});

describe("WorkforcePersonnelOrdersService settings", () => {
  const prisma: any = {
    organization: { findFirst: jest.fn(), update: jest.fn() },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const svc = new WorkforcePersonnelOrdersService(
    prisma,
    entitlement as never,
    { log: jest.fn() } as never,
    { resolveScopeForCommercialOrg: jest.fn() } as never,
    { getPersonOpsProfile: jest.fn() } as never,
    { resolvePersonProfiles: jest.fn() } as never,
    { fetchEmploymentMirror: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
  });

  it("getWorkforceOrderSettings reads org.settings.workforce gate", async () => {
    prisma.organization.findFirst.mockResolvedValue({
      settings: { workforce: { requireOrderIssuedBeforeTerminate: true } },
    });
    await expect(svc.getWorkforceOrderSettings(ORG_A)).resolves.toEqual({
      requireOrderIssuedBeforeTerminate: true,
    });
  });

  it("patchWorkforceOrderSettings merges settings.workforce only", async () => {
    prisma.organization.findFirst.mockResolvedValue({
      settings: { billing: { foo: 1 }, workforce: { other: true } },
    });
    prisma.organization.update.mockResolvedValue({});
    await expect(
      svc.patchWorkforceOrderSettings(ORG_A, {
        requireOrderIssuedBeforeTerminate: false,
      }),
    ).resolves.toEqual({ requireOrderIssuedBeforeTerminate: false });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_A },
      data: {
        settings: {
          billing: { foo: 1 },
          workforce: { other: true, requireOrderIssuedBeforeTerminate: false },
        },
      },
    });
  });
});

describe("workforce audit catalog", () => {
  it("includes wave-4 actions", () => {
    expect(WORKFORCE_AUDIT_ACTIONS).toContain("WORKFORCE_IMPORT_APPLIED");
    expect(WORKFORCE_AUDIT_ACTIONS).toContain("STAFF_SCHEDULE_SUBMITTED");
    expect(WORKFORCE_AUDIT_ACTIONS).toContain("PERSONNEL_ORDER_PDF_DOWNLOADED");
    expect(WORKFORCE_AUDIT_ACTIONS).toContain("PERSONNEL_ORDER_CANCELLED");
  });
});
