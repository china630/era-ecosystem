import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EmasContractEventStatus,
  EmasContractEventType,
  IntegrationSyncStatus,
  Prisma,
} from "@erafinance/database";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeesService } from "./employees.service";
import { EmasSubmissionAdapterFactory } from "./emas-submission.adapters";
import type { EmasHireDto } from "./dto/emas-hire.dto";
import type { EmasTransferDto } from "./dto/emas-transfer.dto";
import type { EmasTerminateDto } from "./dto/emas-terminate.dto";
import { EMAS_FIELD_MAPPING_VERSION } from "@erafinance/api-contracts";
import {
  parseEmasMode,
  shouldEnqueueEmasManual,
  type EmasMode,
} from "./emas-mode";
import { todayBakuYmd } from "@era/satellite-kit/time";

export { EMAS_FIELD_MAPPING_VERSION };

function stripInternalRate(payload: Record<string, unknown>): Record<string, unknown> {
  const { internalRate: _drop, ...rest } = payload as Record<string, unknown> & {
    internalRate?: unknown;
  };
  return rest;
}

function csvEsc(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

@Injectable()
export class EmasContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly adapterFactory: EmasSubmissionAdapterFactory,
  ) {}

  getMode(settings: unknown): EmasMode {
    return parseEmasMode(settings);
  }

  isS2sConfigured(): boolean {
    return this.adapterFactory.isGatewayConfigured();
  }

  private resolveAsanUserId(settingsJson: unknown): string | null {
    if (!settingsJson || typeof settingsJson !== "object") return null;
    const tax = (settingsJson as Record<string, unknown>).tax;
    if (!tax || typeof tax !== "object") return null;
    const id = (tax as Record<string, unknown>).asanUserId;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }

  private async signerContext(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    return {
      organizationId,
      asanUserId: this.resolveAsanUserId(org?.settings),
    };
  }

  listEvents(organizationId: string, employeeId: string) {
    return this.prisma.emasContractEvent.findMany({
      where: { organizationId, employeeId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Wave 7: create PENDING_MANUAL queue row — never calls HTTP gateway.
   * OFF → no-op. SELECTIVE → emasEligible only. FULL → always.
   */
  async enqueueManualLifecycle(
    organizationId: string,
    employeeId: string,
    eventType: EmasContractEventType,
    extras?: Record<string, unknown>,
  ): Promise<{
    enqueued: boolean;
    reason?: string;
    eventId?: string;
    mode: EmasMode;
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    const mode = parseEmasMode(org.settings);
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: {
        id: true,
        emasEligible: true,
        cpEmploymentId: true,
        salary: true,
        hireDate: true,
        contractEndDate: true,
        globalPersonId: true,
      },
    });
    if (!emp) {
      throw new NotFoundException("Employee not found");
    }
    if (!shouldEnqueueEmasManual({ mode, emasEligible: emp.emasEligible })) {
      return {
        enqueued: false,
        reason: mode === "OFF" ? "emas_mode_off" : "not_eligible",
        mode,
      };
    }

    const existingOpen = await this.prisma.emasContractEvent.findFirst({
      where: {
        organizationId,
        employeeId,
        eventType,
        status: EmasContractEventStatus.PENDING_MANUAL,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingOpen) {
      return {
        enqueued: false,
        reason: "already_pending_manual",
        eventId: existingOpen.id,
        mode,
      };
    }

    const salaryGrossAzn = emp.salary.toFixed(2);
    let displayName: string | null = null;
    let finCode: string | null = null;
    let finPending = !emp.emasEligible;
    try {
      const prefill = await this.employees.getEmasPrefill(organizationId, {
        employeeId: emp.id,
      });
      displayName =
        [prefill.lastName, prefill.firstName].filter(Boolean).join(" ").trim() ||
        null;
      finCode = prefill.finCode;
      finPending =
        prefill.emasStatus === "PENDING_FIN" || !prefill.finCode;
    } catch {
      /* MDM unavailable — still enqueue with ids */
    }
    const payload = stripInternalRate({
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      eventType,
      employeeId: emp.id,
      cpEmploymentId: emp.cpEmploymentId,
      globalPersonId: emp.globalPersonId,
      displayName,
      finCode,
      salaryGrossAzn,
      contractStartDate: emp.hireDate.toISOString().slice(0, 10),
      contractEndDate: emp.contractEndDate
        ? emp.contractEndDate.toISOString().slice(0, 10)
        : null,
      finPending,
      channel: "PENDING_MANUAL",
      ...(extras ?? {}),
    });

    const event = await this.prisma.emasContractEvent.create({
      data: {
        organizationId,
        employeeId,
        eventType,
        status: EmasContractEventStatus.PENDING_MANUAL,
        correlationId: randomUUID(),
        payloadJson: payload as Prisma.InputJsonValue,
        mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      },
    });

    return { enqueued: true, eventId: event.id, mode };
  }

  async listQueue(
    organizationId: string,
    opts?: { status?: string; limit?: number },
  ) {
    const take = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
    const status =
      opts?.status &&
      Object.values(EmasContractEventStatus).includes(
        opts.status as EmasContractEventStatus,
      )
        ? (opts.status as EmasContractEventStatus)
        : undefined;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const mode = parseEmasMode(org?.settings);

    const events = await this.prisma.emasContractEvent.findMany({
      where: {
        organizationId,
        ...(status
          ? { status }
          : {
              status: {
                in: [
                  EmasContractEventStatus.PENDING_MANUAL,
                  EmasContractEventStatus.SUBMITTED_MANUAL,
                  EmasContractEventStatus.FAILED,
                ],
              },
            }),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        employee: {
          select: {
            id: true,
            globalPersonId: true,
            cpEmploymentId: true,
            salary: true,
            emasEligible: true,
            hireDate: true,
            jobPosition: {
              select: {
                name: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const actorIds = [
      ...new Set(
        events
          .map((e) => e.submittedByUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const actors =
      actorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, email: true },
          })
        : [];
    const actorEmailById = new Map(actors.map((u) => [u.id, u.email]));

    const orchBase =
      process.env.ORCHESTRATOR_WEB_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_ORCH_WEB_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_ORCHESTRATOR_URL?.replace(/\/$/, "") ||
      "";

    return {
      emasMode: mode,
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      s2sConfigured: this.isS2sConfigured(),
      /** List URL; per-row deep-link uses personnelOrderUrl on items. */
      personnelOrdersUrl: orchBase
        ? `${orchBase}/workspace/workforce/personnel-orders`
        : null,
      portalUrl: "https://emas.sosial.gov.az",
      items: events.map((e) => {
        const payload =
          e.payloadJson && typeof e.payloadJson === "object"
            ? (e.payloadJson as Record<string, unknown>)
            : {};
        const salaryGrossAzn =
          typeof payload.salaryGrossAzn === "string"
            ? payload.salaryGrossAzn
            : e.employee.salary.toFixed(2);
        const contractStartDate =
          typeof payload.contractStartDate === "string"
            ? payload.contractStartDate
            : e.employee.hireDate.toISOString().slice(0, 10);
        const contractEndDate =
          typeof payload.contractEndDate === "string"
            ? payload.contractEndDate
            : typeof payload.terminationDate === "string"
              ? payload.terminationDate
              : null;
        const displayName =
          typeof payload.displayName === "string" ? payload.displayName : null;
        const finCode =
          typeof payload.finCode === "string" ? payload.finCode : null;
        const cpEmploymentId = e.employee.cpEmploymentId;
        return {
          id: e.id,
          employeeId: e.employeeId,
          eventType: e.eventType,
          status: e.status,
          /** Plan ERROR label maps to FAILED in schema. */
          statusLabel: e.status === EmasContractEventStatus.FAILED ? "ERROR" : e.status,
          correlationId: e.correlationId,
          mappingVersion: e.mappingVersion,
          createdAt: e.createdAt,
          submittedAt: e.submittedAt,
          submittedByUserId: e.submittedByUserId,
          submittedByEmail: e.submittedByUserId
            ? actorEmailById.get(e.submittedByUserId) ?? null
            : null,
          submittedByLabel: e.submittedByUserId
            ? actorEmailById.get(e.submittedByUserId) ?? null
            : null,
          errorMessage: e.errorMessage,
          salaryGrossAzn,
          finPending: payload.finPending === true || !e.employee.emasEligible,
          finCode,
          displayName,
          contractStartDate,
          contractEndDate,
          cpEmploymentId,
          globalPersonId: e.employee.globalPersonId,
          positionTitle: e.employee.jobPosition.name,
          departmentName: e.employee.jobPosition.department?.name ?? null,
          personnelOrderUrl:
            orchBase && cpEmploymentId
              ? `${orchBase}/workspace/workforce/personnel-orders?employmentId=${encodeURIComponent(cpEmploymentId)}&autoPdf=1&orderType=${encodeURIComponent(
                  e.eventType === "TERMINATE"
                    ? "TERMINATE"
                    : e.eventType === "TRANSFER"
                      ? "TRANSFER"
                      : "HIRE",
                )}`
              : orchBase
                ? `${orchBase}/workspace/workforce/personnel-orders`
                : null,
        };
      }),
    };
  }

  async markSubmittedManual(
    organizationId: string,
    eventId: string,
    actorUserId: string,
    note?: string,
  ) {
    const event = await this.prisma.emasContractEvent.findFirst({
      where: { id: eventId, organizationId },
    });
    if (!event) throw new NotFoundException("Emas event not found");
    if (
      event.status !== EmasContractEventStatus.PENDING_MANUAL &&
      event.status !== EmasContractEventStatus.FAILED
    ) {
      throw new BadRequestException(
        "Only PENDING_MANUAL or FAILED events can be marked submitted manually",
      );
    }
    const prev =
      event.payloadJson && typeof event.payloadJson === "object"
        ? (event.payloadJson as Record<string, unknown>)
        : {};
    return this.prisma.emasContractEvent.update({
      where: { id: event.id },
      data: {
        status: EmasContractEventStatus.SUBMITTED_MANUAL,
        submittedAt: new Date(),
        submittedByUserId: actorUserId,
        errorMessage: null,
        payloadJson: {
          ...prev,
          manualNote: note?.trim() || null,
          markedManualAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  async exportQueueCsv(organizationId: string): Promise<string> {
    const queue = await this.listQueue(organizationId, {
      status: EmasContractEventStatus.PENDING_MANUAL,
      limit: 500,
    });
    // Wave 7 PUSH lite — CSV (Excel-compatible). Never include internalRate.
    const header =
      "eventId,employeeId,cpEmploymentId,globalPersonId,displayName,finCode,eventType,status,finPending,positionTitle,departmentName,salaryGrossAzn,contractStartDate,contractEndDate,createdAt";
    const lines = queue.items.map((row) =>
      [
        row.id,
        row.employeeId,
        row.cpEmploymentId ?? "",
        row.globalPersonId,
        csvEsc(row.displayName ?? ""),
        csvEsc(row.finCode ?? ""),
        row.eventType,
        row.statusLabel ?? row.status,
        row.finPending ? "1" : "0",
        csvEsc(row.positionTitle),
        csvEsc(row.departmentName ?? ""),
        row.salaryGrossAzn,
        row.contractStartDate ?? "",
        row.contractEndDate ?? "",
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      ].join(","),
    );
    return [header, ...lines].join("\n");
  }

  async submitHire(
    organizationId: string,
    employeeId: string,
    dto: EmasHireDto,
  ) {
    this.adapterFactory.assertEnabled();
    const prefill = await this.employees.getEmasPrefill(organizationId, {
      employeeId,
    });
    if (prefill.emasStatus !== "READY" || !prefill.finCode) {
      throw new BadRequestException(
        "Employee is not ƏMAS-ready — FIN is required (convert-to-FIN or MDM link).",
      );
    }

    const payload = stripInternalRate({
      eventType: "HIRE",
      ...prefill,
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      contractStartDate: dto.contractStartDate ?? prefill.contractStartDate,
      salaryGrossAzn: dto.salaryGrossAzn ?? prefill.salaryGrossAzn,
    });

    return this.pushEvent(
      organizationId,
      employeeId,
      EmasContractEventType.HIRE,
      payload,
      (adapter, signer) => adapter.submitHire(payload, signer),
    );
  }

  async submitTransfer(
    organizationId: string,
    employeeId: string,
    dto: EmasTransferDto,
  ) {
    this.adapterFactory.assertEnabled();
    const prefill = await this.employees.getEmasPrefill(organizationId, {
      employeeId,
    });
    if (prefill.emasStatus !== "READY" || !prefill.finCode) {
      throw new BadRequestException(
        "Employee is not ƏMAS-ready — FIN is required for transfer.",
      );
    }

    const payload = stripInternalRate({
      eventType: "TRANSFER",
      ...prefill,
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      positionTitle: dto.positionTitle ?? prefill.positionTitle,
      departmentName: dto.departmentName ?? prefill.departmentName,
      salaryGrossAzn: dto.salaryGrossAzn ?? prefill.salaryGrossAzn,
      effectiveDate: dto.effectiveDate ?? todayBakuYmd(),
    });

    return this.pushEvent(
      organizationId,
      employeeId,
      EmasContractEventType.TRANSFER,
      payload,
      (adapter, signer) => adapter.submitTransfer(payload, signer),
    );
  }

  async submitTerminate(
    organizationId: string,
    employeeId: string,
    dto: EmasTerminateDto,
  ) {
    this.adapterFactory.assertEnabled();
    const prefill = await this.employees.getEmasPrefill(organizationId, {
      employeeId,
    });

    const payload = stripInternalRate({
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      eventType: "TERMINATE",
      employeeId: prefill.employeeId,
      cpEmploymentId: prefill.cpEmploymentId,
      finCode: prefill.finCode,
      salaryGrossAzn: prefill.salaryGrossAzn,
      terminationDate:
        dto.terminationDate ?? todayBakuYmd(),
      reason: dto.reason ?? null,
    });

    return this.pushEvent(
      organizationId,
      employeeId,
      EmasContractEventType.TERMINATE,
      payload,
      (adapter, signer) => adapter.submitTerminate(payload, signer),
    );
  }

  private async pushEvent(
    organizationId: string,
    employeeId: string,
    eventType: EmasContractEventType,
    payload: Record<string, unknown>,
    submit: (
      adapter: ReturnType<EmasSubmissionAdapterFactory["get"]>,
      signer: Awaited<ReturnType<EmasContractService["signerContext"]>>,
    ) => Promise<{
      submitted: boolean;
      externalId?: string | null;
      gatewayStatus?: number;
      gatewayMessage?: string;
    }>,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException("Employee not found");

    const safePayload = stripInternalRate(payload);
    const correlationId = randomUUID();
    const event = await this.prisma.emasContractEvent.create({
      data: {
        organizationId,
        employeeId,
        eventType,
        status: EmasContractEventStatus.PENDING,
        correlationId,
        payloadJson: safePayload as Prisma.InputJsonValue,
        mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      },
    });

    const adapter = this.adapterFactory.get();
    const signer = await this.signerContext(organizationId);

    try {
      const result = await submit(adapter, signer);
      const externalId = result.externalId ?? null;
      const status = result.submitted
        ? EmasContractEventStatus.SUBMITTED
        : EmasContractEventStatus.FAILED;

      const [updatedEvent] = await this.prisma.$transaction([
        this.prisma.emasContractEvent.update({
          where: { id: event.id },
          data: {
            status,
            emasExternalId: externalId,
            submittedAt: result.submitted ? new Date() : null,
            errorMessage: result.gatewayMessage ?? null,
          },
        }),
        ...(externalId
          ? [
              this.prisma.employee.update({
                where: { id: employeeId },
                data: {
                  emasExternalId: externalId,
                  emasSyncStatus: IntegrationSyncStatus.SYNCED,
                  emasSyncedAt: new Date(),
                  emasSyncError: null,
                },
              }),
            ]
          : []),
      ]);

      return {
        event: updatedEvent,
        submission: result,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.emasContractEvent.update({
        where: { id: event.id },
        data: {
          status: EmasContractEventStatus.FAILED,
          errorMessage: message.slice(0, 2000),
        },
      });
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: {
          emasSyncStatus: IntegrationSyncStatus.ERROR,
          emasSyncError: message.slice(0, 500),
        },
      });
      throw e;
    }
  }
}
