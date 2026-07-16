import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EmasContractEventStatus,
  EmasContractEventType,
  IntegrationSyncStatus,
} from "@erafinance/database";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeesService } from "./employees.service";
import { EmasSubmissionAdapterFactory } from "./emas-submission.adapters";
import type { EmasHireDto } from "./dto/emas-hire.dto";
import type { EmasTransferDto } from "./dto/emas-transfer.dto";
import type { EmasTerminateDto } from "./dto/emas-terminate.dto";

/** Bump when e-müqavilə portal field mapping changes (normative updates). */
export const EMAS_FIELD_MAPPING_VERSION = 1;

@Injectable()
export class EmasContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly adapterFactory: EmasSubmissionAdapterFactory,
  ) {}

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

    const payload = {
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      eventType: "HIRE",
      ...prefill,
      contractStartDate: dto.contractStartDate ?? prefill.contractStartDate,
      salaryGrossAzn: dto.salaryGrossAzn ?? prefill.salaryGrossAzn,
    };

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

    const payload = {
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      eventType: "TRANSFER",
      ...prefill,
      positionTitle: dto.positionTitle ?? prefill.positionTitle,
      departmentName: dto.departmentName ?? prefill.departmentName,
      salaryGrossAzn: dto.salaryGrossAzn ?? prefill.salaryGrossAzn,
      effectiveDate: dto.effectiveDate ?? new Date().toISOString().slice(0, 10),
    };

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

    const payload = {
      mappingVersion: EMAS_FIELD_MAPPING_VERSION,
      eventType: "TERMINATE",
      employeeId: prefill.employeeId,
      cpEmploymentId: prefill.cpEmploymentId,
      finCode: prefill.finCode,
      terminationDate:
        dto.terminationDate ?? new Date().toISOString().slice(0, 10),
      reason: dto.reason ?? null,
    };

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

    const correlationId = randomUUID();
    const event = await this.prisma.emasContractEvent.create({
      data: {
        organizationId,
        employeeId,
        eventType,
        status: EmasContractEventStatus.PENDING,
        correlationId,
        payloadJson: payload as object,
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
      const failed = await this.prisma.emasContractEvent.update({
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
