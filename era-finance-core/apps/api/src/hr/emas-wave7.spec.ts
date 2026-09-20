import {
  EmasContractEventStatus,
  EmasContractEventType,
} from "@erafinance/database";
import { EmasContractService } from "./emas-contract.service";
import { parseEmasMode, shouldEnqueueEmasManual } from "./emas-mode";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ACTOR = "33333333-3333-4333-8333-333333333333";

describe("emas-mode helpers", () => {
  it("defaults to OFF", () => {
    expect(parseEmasMode(null)).toBe("OFF");
    expect(parseEmasMode({})).toBe("OFF");
  });

  it("reads settings.hr.emasMode", () => {
    expect(parseEmasMode({ hr: { emasMode: "FULL" } })).toBe("FULL");
    expect(parseEmasMode({ hr: { emasMode: "SELECTIVE" } })).toBe("SELECTIVE");
  });

  it("OFF never enqueues; SELECTIVE needs eligible; FULL always", () => {
    expect(shouldEnqueueEmasManual({ mode: "OFF", emasEligible: true })).toBe(
      false,
    );
    expect(
      shouldEnqueueEmasManual({ mode: "SELECTIVE", emasEligible: false }),
    ).toBe(false);
    expect(
      shouldEnqueueEmasManual({ mode: "SELECTIVE", emasEligible: true }),
    ).toBe(true);
    expect(shouldEnqueueEmasManual({ mode: "FULL", emasEligible: false })).toBe(
      true,
    );
  });
});

describe("EmasContractService wave 7", () => {
  const prisma: any = {
    organization: { findUnique: jest.fn() },
    employee: { findFirst: jest.fn(), update: jest.fn() },
    emasContractEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const employees = {
    getEmasPrefill: jest.fn(),
  };
  const adapterFactory = {
    assertEnabled: jest.fn(),
    get: jest.fn(),
  };
  const svc = new EmasContractService(
    prisma,
    employees as never,
    adapterFactory as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findUnique.mockResolvedValue({
      settings: { hr: { emasMode: "FULL" } },
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: EMP,
      organizationId: ORG,
      emasEligible: true,
      cpEmploymentId: "cp-1",
      salary: { toFixed: () => "1000.00" },
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
      contractEndDate: null,
      globalPersonId: "gp-1",
      jobPosition: { name: "Cleaner", department: { name: "Ops" } },
    });
    prisma.emasContractEvent.findFirst.mockResolvedValue(null);
    prisma.emasContractEvent.create.mockImplementation(async ({ data }: any) => ({
      id: "evt-1",
      ...data,
    }));
    prisma.emasContractEvent.findMany.mockResolvedValue([]);
    employees.getEmasPrefill.mockResolvedValue({
      lastName: "Aliyev",
      firstName: "Ali",
      finCode: "ABC1234",
      emasStatus: "READY",
    });
  });

  it("listQueue attaches submittedByEmail from User", async () => {
    prisma.emasContractEvent.findMany.mockResolvedValue([
      {
        id: "evt-1",
        employeeId: EMP,
        eventType: EmasContractEventType.HIRE,
        status: EmasContractEventStatus.SUBMITTED_MANUAL,
        correlationId: "c1",
        mappingVersion: 1,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        submittedAt: new Date("2026-09-02T00:00:00.000Z"),
        submittedByUserId: ACTOR,
        errorMessage: null,
        payloadJson: { salaryGrossAzn: "1000.00" },
        employee: {
          id: EMP,
          globalPersonId: "gp-1",
          cpEmploymentId: "cp-1",
          salary: { toFixed: () => "1000.00" },
          emasEligible: true,
          hireDate: new Date("2026-01-01T00:00:00.000Z"),
          jobPosition: { name: "Cleaner", department: { name: "Ops" } },
        },
      },
    ]);
    prisma.user = {
      findMany: jest.fn().mockResolvedValue([{ id: ACTOR, email: "hr@evrostar.az" }]),
    };
    const queue = await svc.listQueue(ORG);
    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(queue.items[0].submittedByEmail).toBe("hr@evrostar.az");
    expect(queue.items[0].submittedByLabel).toBe("hr@evrostar.az");
  });

  it("enqueue TRANSFER creates PENDING_MANUAL with extras", async () => {
    const r = await svc.enqueueManualLifecycle(
      ORG,
      EMP,
      EmasContractEventType.TRANSFER,
      { toPositionId: "pos-1", toPositionName: "Lead" },
    );
    expect(r.enqueued).toBe(true);
    const created = prisma.emasContractEvent.create.mock.calls[0][0].data;
    expect(created.eventType).toBe(EmasContractEventType.TRANSFER);
    expect(created.status).toBe(EmasContractEventStatus.PENDING_MANUAL);
    expect(created.payloadJson.toPositionName).toBe("Lead");
  });

  it("enqueueManual creates PENDING_MANUAL without calling adapter", async () => {
    const r = await svc.enqueueManualLifecycle(
      ORG,
      EMP,
      EmasContractEventType.HIRE,
    );
    expect(r.enqueued).toBe(true);
    expect(adapterFactory.assertEnabled).not.toHaveBeenCalled();
    expect(adapterFactory.get).not.toHaveBeenCalled();
    const created = prisma.emasContractEvent.create.mock.calls[0][0].data;
    expect(created.status).toBe(EmasContractEventStatus.PENDING_MANUAL);
    expect(created.payloadJson.salaryGrossAzn).toBe("1000.00");
    expect(created.payloadJson.internalRate).toBeUndefined();
  });

  it("mode OFF does not enqueue", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      settings: { hr: { emasMode: "OFF" } },
    });
    const r = await svc.enqueueManualLifecycle(
      ORG,
      EMP,
      EmasContractEventType.HIRE,
    );
    expect(r.enqueued).toBe(false);
    expect(r.reason).toBe("emas_mode_off");
    expect(prisma.emasContractEvent.create).not.toHaveBeenCalled();
  });

  it("SELECTIVE skips non-eligible", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      settings: { hr: { emasMode: "SELECTIVE" } },
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: EMP,
      emasEligible: false,
      cpEmploymentId: null,
      salary: { toFixed: () => "0.00" },
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
      contractEndDate: null,
      globalPersonId: "gp-1",
    });
    const r = await svc.enqueueManualLifecycle(
      ORG,
      EMP,
      EmasContractEventType.HIRE,
    );
    expect(r.enqueued).toBe(false);
    expect(r.reason).toBe("not_eligible");
  });

  it("listQueue is org-scoped (findMany where organizationId)", async () => {
    await svc.listQueue(ORG);
    expect(prisma.emasContractEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
      }),
    );
  });

  it("markSubmittedManual sets SUBMITTED_MANUAL + actor", async () => {
    prisma.emasContractEvent.findFirst.mockResolvedValue({
      id: "evt-1",
      organizationId: ORG,
      status: EmasContractEventStatus.PENDING_MANUAL,
      payloadJson: { salaryGrossAzn: "1000.00" },
    });
    prisma.emasContractEvent.update.mockResolvedValue({
      id: "evt-1",
      status: EmasContractEventStatus.SUBMITTED_MANUAL,
    });
    await svc.markSubmittedManual(ORG, "evt-1", ACTOR, "uploaded");
    expect(prisma.emasContractEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmasContractEventStatus.SUBMITTED_MANUAL,
          submittedByUserId: ACTOR,
        }),
      }),
    );
  });

  it("submitHire still requires adapter assertEnabled (503 path)", async () => {
    adapterFactory.assertEnabled.mockImplementation(() => {
      const err: any = new Error("EMAS_S2S_DISABLED");
      err.status = 503;
      throw err;
    });
    await expect(
      svc.submitHire(ORG, EMP, {}),
    ).rejects.toBeTruthy();
    expect(adapterFactory.assertEnabled).toHaveBeenCalled();
  });

  it("export CSV never includes internalRate column", async () => {
    prisma.emasContractEvent.findMany.mockResolvedValue([
      {
        id: "evt-1",
        employeeId: EMP,
        eventType: EmasContractEventType.HIRE,
        status: EmasContractEventStatus.PENDING_MANUAL,
        correlationId: "c1",
        mappingVersion: 1,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        submittedAt: null,
        submittedByUserId: null,
        errorMessage: null,
        payloadJson: { salaryGrossAzn: "1000.00", internalRate: "9999" },
        employee: {
          id: EMP,
          globalPersonId: "gp-1",
          cpEmploymentId: "cp-1",
          salary: { toFixed: () => "1000.00" },
          emasEligible: true,
          hireDate: new Date(),
          jobPosition: { name: "Cleaner", department: { name: "Ops" } },
        },
      },
    ]);
    const csv = await svc.exportQueueCsv(ORG);
    expect(csv).toContain("salaryGrossAzn");
    expect(csv.toLowerCase()).not.toContain("internalrate");
    expect(csv).toContain("1000.00");
    expect(csv).not.toContain("9999");
  });

  it("cross-org employee lookup fails enqueue", async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      svc.enqueueManualLifecycle(ORG_B, EMP, EmasContractEventType.HIRE),
    ).rejects.toBeTruthy();
  });

  it("export CSV includes FIN / name / dates columns", async () => {
    prisma.emasContractEvent.findMany.mockResolvedValue([
      {
        id: "evt-1",
        employeeId: EMP,
        eventType: EmasContractEventType.HIRE,
        status: EmasContractEventStatus.PENDING_MANUAL,
        correlationId: "c1",
        mappingVersion: 1,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        submittedAt: null,
        submittedByUserId: null,
        errorMessage: null,
        payloadJson: {
          salaryGrossAzn: "1000.00",
          displayName: "Aliyev Ali",
          finCode: "ABC1234",
          contractStartDate: "2026-01-01",
        },
        employee: {
          id: EMP,
          globalPersonId: "gp-1",
          cpEmploymentId: "cp-1",
          salary: { toFixed: () => "1000.00" },
          emasEligible: true,
          hireDate: new Date("2026-01-01T00:00:00.000Z"),
          jobPosition: { name: "Cleaner", department: { name: "Ops" } },
        },
      },
    ]);
    const csv = await svc.exportQueueCsv(ORG);
    expect(csv).toContain("finCode");
    expect(csv).toContain("displayName");
    expect(csv).toContain("contractStartDate");
    expect(csv).toContain("ABC1234");
    expect(csv.toLowerCase()).not.toContain("internalrate");
  });
});

describe("HttpEmasSubmissionAdapter wave 7", () => {
  it("throws 503 EMAS_GATEWAY_NOT_CONFIGURED when EMAS_SUBMIT_URL unset", async () => {
    const { HttpEmasSubmissionAdapter } = await import(
      "./emas-submission.adapters"
    );
    const { HttpException } = await import("@nestjs/common");
    const adapter = new HttpEmasSubmissionAdapter({
      get: () => undefined,
    } as never);
    try {
      await adapter.submitHire(
        { employeeId: EMP },
        { organizationId: ORG, asanUserId: null },
      );
      fail("expected HttpException");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as InstanceType<typeof HttpException>).getStatus()).toBe(503);
      const body = (e as InstanceType<typeof HttpException>).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe("EMAS_GATEWAY_NOT_CONFIGURED");
    }
  });
});

describe("getEmasPrefill org isolation", () => {
  it("cpEmploymentId in another org → 404", async () => {
    const { EmployeesService } = await import("./employees.service");
    const { NotFoundException } = await import("@nestjs/common");
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const svc = new EmployeesService(
      prisma as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
    );
    await expect(
      svc.getEmasPrefill(ORG, { cpEmploymentId: "cp-foreign" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
